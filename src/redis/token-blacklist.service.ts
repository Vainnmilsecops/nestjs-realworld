import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {createClient} from 'redis';

const DEFAULT_REDIS_TIMEOUT_MS = 2000;
const DEFAULT_REDIS_QUEUE_LIMIT = 1000;

@Injectable()
export class TokenBlacklistService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TokenBlacklistService.name);
  private client?: ReturnType<typeof createClient>;
  private timeoutMs = DEFAULT_REDIS_TIMEOUT_MS;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    this.timeoutMs = this.config.get<number>(
      'REDIS_TIMEOUT_MS',
      DEFAULT_REDIS_TIMEOUT_MS,
    );
    this.client = createClient({
      url: this.config.getOrThrow<string>('REDIS_URL'),
      socket: {connectTimeout: this.timeoutMs, reconnectStrategy: false},
      disableOfflineQueue: true,
      commandsQueueMaxLength: this.config.get<number>(
        'REDIS_QUEUE_LIMIT',
        DEFAULT_REDIS_QUEUE_LIMIT,
      ),
    });
    this.client.on('error', (error: unknown) =>
      this.logFailure('redis_connection_error', error),
    );
    try {
      await this.client.connect();
    } catch (error: unknown) {
      this.logFailure('redis_connect_failed', error);
      if (this.client.isOpen) this.client.destroy();
      throw new ServiceUnavailableException('Session store unavailable');
    }
  }

  async onModuleDestroy(): Promise<void> {
    const client = this.client;
    if (!client?.isOpen) return;
    try {
      await client.close();
    } catch (error: unknown) {
      this.logFailure('redis_close_failed', error);
      if (client.isOpen) client.destroy();
    }
  }

  async isRevoked(jti: string): Promise<boolean> {
    try {
      const exists = await this.getClient()
        .withCommandOptions({abortSignal: AbortSignal.timeout(this.timeoutMs)})
        .exists(this.key(jti));
      return exists > 0;
    } catch (error: unknown) {
      this.logFailure('redis_revocation_lookup_failed', error);
      throw new ServiceUnavailableException('Session store unavailable');
    }
  }

  async revoke(jti: string, expiresAtUnixSeconds: number): Promise<void> {
    if (expiresAtUnixSeconds <= Math.floor(Date.now() / 1000)) return;
    try {
      await this.getClient()
        .withCommandOptions({abortSignal: AbortSignal.timeout(this.timeoutMs)})
        .set(this.key(jti), '1', {EXAT: expiresAtUnixSeconds});
    } catch (error: unknown) {
      this.logFailure('redis_revocation_write_failed', error);
      throw new ServiceUnavailableException('Session store unavailable');
    }
  }

  private getClient(): ReturnType<typeof createClient> {
    if (!this.client?.isReady) {
      throw new ServiceUnavailableException('Session store unavailable');
    }
    return this.client;
  }

  private logFailure(event: string, error: unknown): void {
    this.logger.error({
      event,
      cause: error instanceof Error ? error.name : 'unknown',
      action:
        'Check Redis availability; restart the API if its connection is closed',
    });
  }

  private key(jti: string): string {
    return `auth:revoked:${jti}`;
  }
}
