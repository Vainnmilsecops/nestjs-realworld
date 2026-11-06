import {randomBytes} from 'node:crypto';

const generatedSecret = randomBytes(48).toString('hex');

export function configureTestServices() {
  const databaseUrl = process.env.TEST_DATABASE_URL;
  const redisUrl = process.env.TEST_REDIS_URL;
  if (!databaseUrl || !redisUrl) {
    throw new Error(
      'Set explicit TEST_DATABASE_URL and TEST_REDIS_URL for integration tests',
    );
  }
  let database: URL;
  let redis: URL;
  try {
    database = new URL(databaseUrl);
    redis = new URL(redisUrl);
  } catch {
    throw new Error('Integration service URLs must be valid absolute URLs');
  }
  const databaseName = decodeURIComponent(database.pathname.slice(1));
  if (
    !['postgres:', 'postgresql:'].includes(database.protocol) ||
    !databaseName.endsWith('_test') ||
    databaseName.includes('/')
  ) {
    throw new Error(
      'TEST_DATABASE_URL must name a dedicated PostgreSQL database ending in _test',
    );
  }
  const redisIndex = Number(redis.pathname.slice(1));
  if (
    !['redis:', 'rediss:'].includes(redis.protocol) ||
    !/^\/\d+$/.test(redis.pathname) ||
    !Number.isSafeInteger(redisIndex) ||
    redisIndex < 1
  ) {
    throw new Error(
      'TEST_REDIS_URL must select an explicit Redis database index greater than zero',
    );
  }
  const jwtSecret = process.env.TEST_JWT_SECRET ?? generatedSecret;
  if (jwtSecret.length < 32)
    throw new Error('TEST_JWT_SECRET must contain at least 32 characters');
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DATABASE_URL: databaseUrl,
    REDIS_URL: redisUrl,
    JWT_SECRET: jwtSecret,
    JWT_EXPIRES_IN_SECONDS: '3600',
    // Validation cases intentionally exercise each authentication route repeatedly.
    AUTH_RATE_LIMIT: '1000',
  });
  return {databaseUrl, redisUrl, jwtSecret};
}
