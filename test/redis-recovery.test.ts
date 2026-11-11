import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {once} from 'node:events';
import {createConnection, createServer, Socket} from 'node:net';
import {it} from 'node:test';
import {setTimeout as delay} from 'node:timers/promises';
import {ServiceUnavailableException} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {createClient} from 'redis';
import {TokenBlacklistService} from '../src/redis/token-blacklist.service';
import {configureTestServices} from './support/services';

function isUnavailable(error: unknown): boolean {
  return (
    error instanceof ServiceUnavailableException && error.getStatus() === 503
  );
}

async function waitFor(
  check: () => boolean | Promise<boolean>,
  message: string,
): Promise<void> {
  const deadline = Date.now() + 5000;
  while (!(await check())) {
    assert.ok(Date.now() < deadline, message);
    await delay(25);
  }
}

it(
  'fails closed during a Redis disconnect and resumes revocation checks after reconnect',
  {timeout: 15000},
  async (t) => {
    const {redisUrl} = configureTestServices();
    const target = new URL(redisUrl);
    if (target.protocol === 'rediss:') {
      t.skip(
        'The recovery proxy covers the plaintext Redis service used in CI',
      );
      return;
    }

    const upstreamPort = Number(target.port || 6379);
    const sockets = new Set<Socket>();
    let acceptingConnections = true;
    let refusedConnections = 0;
    const proxy = createServer((downstream) => {
      if (!acceptingConnections) {
        refusedConnections++;
        downstream.destroy();
        return;
      }

      const upstream = createConnection({
        host: target.hostname,
        port: upstreamPort,
      });
      const closeBoth = () => {
        downstream.destroy();
        upstream.destroy();
      };
      for (const socket of [downstream, upstream]) {
        sockets.add(socket);
        socket.on('error', closeBoth);
        socket.once('close', () => {
          sockets.delete(socket);
          closeBoth();
        });
      }
      downstream.pipe(upstream).pipe(downstream);
    });

    const oldJti = randomUUID();
    const rejectedJti = randomUUID();
    const newJti = randomUUID();
    const expiresAt = Math.floor(Date.now() / 1000) + 60;
    const cleanup = createClient({
      url: redisUrl,
      socket: {connectTimeout: 1000, reconnectStrategy: false},
      disableOfflineQueue: true,
    });
    cleanup.on('error', () => {});
    proxy.listen(0, '127.0.0.1');
    await once(proxy, 'listening');
    const address = proxy.address();
    assert.ok(address && typeof address !== 'string');
    const proxyUrl = new URL(redisUrl);
    proxyUrl.hostname = '127.0.0.1';
    proxyUrl.port = String(address.port);
    const service = new TokenBlacklistService(
      new ConfigService({
        REDIS_URL: proxyUrl.toString(),
        REDIS_TIMEOUT_MS: 1000,
      }),
      {t: () => 'Session store unavailable'},
    );
    t.after(async () => {
      await service.onModuleDestroy();
      for (const socket of sockets) socket.destroy();
      if (proxy.listening) {
        const closed = once(proxy, 'close');
        proxy.close();
        await closed;
      }
      try {
        if (cleanup.isReady) {
          await cleanup
            .withCommandOptions({abortSignal: AbortSignal.timeout(1000)})
            .del(
              [oldJti, rejectedJti, newJti].map((jti) => `auth:revoked:${jti}`),
            );
        }
      } finally {
        if (cleanup.isOpen) cleanup.destroy();
      }
    });

    await cleanup.connect();
    await service.onModuleInit();
    await service.revoke(oldJti, expiresAt);
    assert.equal(await service.isRevoked(oldJti), true);

    acceptingConnections = false;
    for (const socket of sockets) socket.destroy();
    await assert.rejects(() => service.isRevoked(oldJti), isUnavailable);
    await assert.rejects(
      () => service.revoke(rejectedJti, expiresAt),
      isUnavailable,
    );
    await waitFor(
      () => refusedConnections >= 2,
      'Redis client did not retry the blocked connection',
    );

    acceptingConnections = true;
    await waitFor(async () => {
      try {
        return await service.isRevoked(oldJti);
      } catch (error) {
        if (isUnavailable(error)) return false;
        throw error;
      }
    }, 'The existing revocation did not become readable after reconnect');
    assert.equal(await service.isRevoked(rejectedJti), false);
    await service.revoke(newJti, expiresAt);
    assert.equal(await service.isRevoked(newJti), true);
  },
);
