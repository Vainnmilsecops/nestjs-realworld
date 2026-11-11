import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {I18nService} from 'nestjs-i18n';
import {createClient} from 'redis';

const DEFAULT_REDIS_TIMEOUT_MS = 2000;
const DEFAULT_REDIS_QUEUE_LIMIT = 1000;
const REDIS_RECONNECT_INITIAL_DELAY_MS = 100;
const REDIS_RECONNECT_MAX_DELAY_MS = 2000;

@Injectable()
export class TokenBlacklistService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TokenBlacklistService.name);
  private client?: ReturnType<typeof createClient>;
  private timeoutMs = DEFAULT_REDIS_TIMEOUT_MS;

  constructor(
    private readonly config: ConfigService,
    @Inject(I18nService)
    private readonly translations: {t(key: string): string},
  ) {}

  async onModuleInit(): Promise<void> {
    this.timeoutMs = this.config.get<number>(
      'REDIS_TIMEOUT_MS',
      DEFAULT_REDIS_TIMEOUT_MS,
    );
    let hasBeenReady = false;
    this.client = createClient({
      url: this.config.getOrThrow<string>('REDIS_URL'),
      socket: {
        connectTimeout: this.timeoutMs,
        reconnectStrategy: (retries) =>
          hasBeenReady
            ? Math.min(
                REDIS_RECONNECT_INITIAL_DELAY_MS * 2 ** retries,
                REDIS_RECONNECT_MAX_DELAY_MS,
              )
            : false,
      },
      disableOfflineQueue: true,
      commandsQueueMaxLength: this.config.get<number>(
        'REDIS_QUEUE_LIMIT',
        DEFAULT_REDIS_QUEUE_LIMIT,
      ),
    });
    this.client.on('error', (error: unknown) =>
      this.logFailure('redis_connection_error', error),
    );
    this.client.once('ready', () => {
      hasBeenReady = true;
    });
    try {
      await this.client.connect();
    } catch (error: unknown) {
      this.logFailure('redis_connect_failed', error);
      if (this.client.isOpen) this.client.destroy();
      throw this.unavailable();
    }
  }

  async onModuleDestroy(): Promise<void> {
    const client = this.client;
    if (!client?.isOpen) return;
    if (!client.isReady) {
      client.destroy();
      return;
    }
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
      throw this.unavailable();
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
      throw this.unavailable();
    }
  }

  private getClient(): ReturnType<typeof createClient> {
    if (!this.client?.isReady) {
      throw this.unavailable();
    }
    return this.client;
  }

  private unavailable(): ServiceUnavailableException {
    return new ServiceUnavailableException(
      this.translations.t('auth.SESSION_STORE_UNAVAILABLE'),
    );
  }

  private logFailure(event: string, error: unknown): void {
    this.logger.error({
      event,
      cause: error instanceof Error ? error.name : 'unknown',
      action: 'Check Redis availability and the API connection settings',
    });
  }

  private key(jti: string): string {
    return `auth:revoked:${jti}`;
  }
}
