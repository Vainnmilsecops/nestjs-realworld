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
  return {...input, APP_HOST: host, APP_PORT: port, CORS_ORIGINS: origins};
}
