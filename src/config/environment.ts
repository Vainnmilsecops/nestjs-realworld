export class EnvironmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvironmentError';
  }
}

export function validateEnvironment(input: Record<string, unknown>) {
  const port = Number(input.APP_PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new EnvironmentError(
      'APP_PORT must be an integer between 1 and 65535',
    );
  }
  const host = input.APP_HOST ?? '127.0.0.1';
  if (typeof host !== 'string' || host.trim() === '') {
    throw new EnvironmentError('APP_HOST must be a non-empty host name');
  }
  const origins = String(input.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (
    !origins.length ||
    origins.some((origin) => {
      try {
        const url = new URL(origin);
        return (
          !['http:', 'https:'].includes(url.protocol) || url.origin !== origin
        );
      } catch {
        return true;
      }
    })
  ) {
    throw new EnvironmentError(
      'CORS_ORIGINS must contain comma-separated HTTP(S) origins',
    );
  }
  const databaseUrl = readConnectionUrl(input.DATABASE_URL, 'DATABASE_URL', [
    'postgres:',
    'postgresql:',
  ]);
  const redisUrl = readConnectionUrl(input.REDIS_URL, 'REDIS_URL', [
    'redis:',
    'rediss:',
  ]);
  const secret = input.JWT_SECRET;
  if (typeof secret !== 'string' || secret.length < 32) {
    throw new EnvironmentError(
      'JWT_SECRET must contain at least 32 characters; run npm run setup',
    );
  }
  return {
    ...input,
    APP_HOST: host,
    APP_PORT: port,
    CORS_ORIGINS: origins,
    DATABASE_URL: databaseUrl,
    REDIS_URL: redisUrl,
    JWT_SECRET: secret,
    JWT_EXPIRES_IN_SECONDS: readInteger(
      input.JWT_EXPIRES_IN_SECONDS ?? 3600,
      'JWT_EXPIRES_IN_SECONDS',
      60,
      604800,
    ),
    AUTH_RATE_LIMIT: readInteger(
      input.AUTH_RATE_LIMIT ?? 10,
      'AUTH_RATE_LIMIT',
      1,
      10000,
    ),
    REDIS_TIMEOUT_MS: readInteger(
      input.REDIS_TIMEOUT_MS ?? 2000,
      'REDIS_TIMEOUT_MS',
      100,
      30000,
    ),
    REDIS_QUEUE_LIMIT: readInteger(
      input.REDIS_QUEUE_LIMIT ?? 1000,
      'REDIS_QUEUE_LIMIT',
      1,
      100000,
    ),
  };
}

function readConnectionUrl(
  value: unknown,
  name: string,
  protocols: string[],
): string {
  if (typeof value === 'string') {
    try {
      const parsed = new URL(value);
      if (
        protocols.includes(parsed.protocol) &&
        parsed.hostname &&
        (name !== 'DATABASE_URL' || parsed.pathname.length > 1)
      )
        return value;
    } catch {
      throw new EnvironmentError(`${name} must be a valid connection URL`);
    }
  }
  throw new EnvironmentError(`${name} must be a valid connection URL`);
}

function readInteger(
  value: unknown,
  name: string,
  minimum: number,
  maximum: number,
): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < minimum || result > maximum) {
    throw new EnvironmentError(
      `${name} must be an integer between ${minimum} and ${maximum}`,
    );
  }
  return result;
}
