import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {describe, it} from 'node:test';
import {ServiceUnavailableException} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {TokenBlacklistService} from '../src/redis/token-blacklist.service';

describe('Blacklist availability', () => {
  it('fails closed when the Redis connection is not ready', async () => {
    const blacklist = new TokenBlacklistService(
      new ConfigService({
        REDIS_URL: 'redis://127.0.0.1:6380/1',
      }),
    );
    const unavailable = (error: unknown): boolean =>
      error instanceof ServiceUnavailableException && error.getStatus() === 503;
    await assert.rejects(() => blacklist.isRevoked(randomUUID()), unavailable);
    await assert.rejects(
      () => blacklist.revoke(randomUUID(), Math.floor(Date.now() / 1000) + 60),
      unavailable,
    );
    await blacklist.onModuleDestroy();
  });
});
