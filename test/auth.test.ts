import 'reflect-metadata';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {after, afterEach, before, beforeEach, describe, it} from 'node:test';
import type {INestApplication} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {JwtService} from '@nestjs/jwt';
import {Test} from '@nestjs/testing';
import {createClient} from 'redis';
import request, {Response} from 'supertest';
import {DataSource, Repository} from 'typeorm';
import type {User} from '../src/users/entities/user.entity';
import {configureTestServices} from './support/services';

interface UserView {
  email: string;
  username: string;
  token: string;
  bio: string | null;
  image: string | null;
}

interface Claims {
  sub: string;
  jti: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

const password = 'Training-password-123!';
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function fixture() {
  const suffix = randomUUID().replaceAll('-', '');
  return {
    username: `trainee_${suffix}`,
    email: `${suffix}@example.com`,
    password,
  };
}

function assertError(response: Response, status: number): void {
  assert.equal(response.status, status);
  const messages = response.body.errors?.body as unknown;
  assert.ok(Array.isArray(messages) && messages.length > 0);
  assert.ok(messages.every((message) => typeof message === 'string'));
  assert.equal(JSON.stringify(response.body).includes(password), false);
}

describe(
  'Authentication with PostgreSQL and Redis',
  {concurrency: false},
  () => {
    let app: INestApplication | undefined;
    let database: DataSource | undefined;
    let users: Repository<User>;
    let redis: ReturnType<typeof createClient> | undefined;
    let jwt: JwtService;
    const keysCreatedByThisSuite = new Set<string>();

    function server() {
      assert.ok(app);
      return app.getHttpServer();
    }

    function claims(token: string): Claims {
      const payload = jwt.verify<Claims>(token);
      keysCreatedByThisSuite.add(`auth:revoked:${payload.jti}`);
      return payload;
    }

    function assertUser(
      response: Response,
      expected: {email: string; username: string},
    ): UserView {
      assert.deepEqual(Object.keys(response.body), ['user']);
      const user = response.body.user as UserView;
      assert.deepEqual(Object.keys(user).sort(), [
        'bio',
        'email',
        'image',
        'token',
        'username',
      ]);
      assert.equal(user.email, expected.email);
      assert.equal(user.username, expected.username);
      assert.equal(user.bio, null);
      assert.equal(user.image, null);
      assert.equal(typeof user.token, 'string');
      claims(user.token);
      assert.match(response.headers['cache-control'] ?? '', /no-store/);
      return user;
    }

    async function register(input = fixture()): Promise<UserView> {
      const response = await request(server())
        .post('/api/users')
        .send({user: input})
        .expect(201);
      return assertUser(response, input);
    }

    async function login(input: {
      email: string;
      username: string;
    }): Promise<UserView> {
      const response = await request(server())
        .post('/api/users/login')
        .send({user: {email: input.email, password}})
        .expect(200);
      return assertUser(response, input);
    }

    async function truncateUsers(): Promise<void> {
      if (!database?.isInitialized) return;
      // Revalidate the explicit service targets immediately before destructive SQL.
      const {databaseUrl} = configureTestServices();
      assert.equal(database.options.type, 'postgres');
      assert.equal((database.options as {url?: string}).url, databaseUrl);
      await database.query('TRUNCATE TABLE public.users');
    }

    before(
      async () => {
        const services = configureTestServices();
        const {databaseOptions} =
          await import('../src/database/database-options');
        const {User: UserEntity} =
          await import('../src/users/entities/user.entity');
        database = new DataSource(databaseOptions(services.databaseUrl));
        await database.initialize();
        await database.runMigrations();
        users = database.getRepository(UserEntity);
        redis = createClient({
          url: services.redisUrl,
          socket: {connectTimeout: 2000, reconnectStrategy: false},
          disableOfflineQueue: true,
        });
        redis.on('error', () => {});
        await redis.connect();
        const {AppModule} = await import('../src/app.module');
        const {configureApplication} =
          await import('../src/bootstrap/configure-application');
        const module = await Test.createTestingModule({
          imports: [AppModule],
        }).compile();
        app = module.createNestApplication();
        configureApplication(app);
        await app.init();
        jwt = app.get(JwtService);
      },
      {timeout: 30000},
    );

    beforeEach(truncateUsers);

    afterEach(async () => {
      try {
        if (redis?.isReady && keysCreatedByThisSuite.size) {
          await redis.del([...keysCreatedByThisSuite]);
        }
      } finally {
        keysCreatedByThisSuite.clear();
        await truncateUsers();
      }
    });

    after(async () => {
      try {
        if (app) await app.close();
      } finally {
        try {
          if (redis?.isOpen) await redis.close();
        } finally {
          if (database?.isInitialized) await database.destroy();
        }
      }
    });

    it('registers a normalized account, stores only a scrypt hash, and issues constrained JWT claims', async () => {
      const input = fixture();
      const response = await request(server())
        .post('/api/users')
        .send({
          user: {
            ...input,
            username: ` ${input.username} `,
            email: ` ${input.email.toUpperCase()} `,
          },
        })
        .expect(201);
      const user = assertUser(response, input);
      const stored = await users.findOne({
        where: {email: input.email},
        select: {id: true, email: true, username: true, passwordHash: true},
      });
      assert.ok(stored);
      assert.match(
        stored.passwordHash,
        /^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/,
      );
      assert.notEqual(stored.passwordHash, password);
      const selectedNormally = await users.findOneByOrFail({id: stored.id});
      assert.equal(selectedNormally.passwordHash, undefined);
      const payload = claims(user.token);
      assert.equal(payload.sub, stored.id);
      assert.match(payload.sub, uuidPattern);
      assert.match(payload.jti, uuidPattern);
      assert.equal(payload.iss, 'realworld-training');
      assert.equal(payload.aud, 'realworld-api');
      assert.equal(payload.exp - payload.iat, 3600);
      const encodedHeader = user.token.split('.')[0];
      assert.ok(encodedHeader);
      assert.equal(
        JSON.parse(Buffer.from(encodedHeader, 'base64url').toString()).alg,
        'HS256',
      );
    });

    it('rejects null, array, malformed, and unknown registration fields without inserting users', async () => {
      const valid = fixture();
      const invalid = [
        {},
        {user: null},
        {user: []},
        {user: 'invalid'},
        {user: {...valid, email: null}},
        {user: {...valid, username: null}},
        {user: {...valid, password: null}},
        {user: {...valid, password: 'short'}},
        {user: {...valid, password: 'a'.repeat(129)}},
        {user: {...valid, id: randomUUID()}},
        {user: valid, admin: true},
      ];
      for (const body of invalid) {
        assertError(await request(server()).post('/api/users').send(body), 422);
      }
      assert.equal(await users.count(), 0);
    });

    it('rejects duplicate email and username using database constraints', async () => {
      const input = fixture();
      await register(input);
      const sameEmail = {...fixture(), email: ` ${input.email.toUpperCase()} `};
      const sameUsername = {...fixture(), username: input.username};
      for (const duplicate of [sameEmail, sameUsername]) {
        assertError(
          await request(server()).post('/api/users').send({user: duplicate}),
          422,
        );
      }
      assert.equal(await users.count(), 1);
    });

    it('logs in with a case-insensitive, trimmed email and returns no internal fields', async () => {
      const input = fixture();
      const registered = await register(input);
      const response = await request(server())
        .post('/api/users/login')
        .send({user: {email: ` ${input.email.toUpperCase()} `, password}})
        .expect(200);
      const loggedIn = assertUser(response, input);
      assert.notEqual(loggedIn.token, registered.token);
      assert.notEqual(claims(loggedIn.token).jti, claims(registered.token).jti);
    });

    it('returns the same generic 401 for unknown accounts and wrong passwords', async () => {
      const user = await register();
      const wrongPassword = await request(server())
        .post('/api/users/login')
        .send({user: {email: user.email, password: 'Another-password-123!'}});
      const unknown = await request(server())
        .post('/api/users/login')
        .send({user: {email: fixture().email, password}});
      assertError(wrongPassword, 401);
      assertError(unknown, 401);
      assert.deepEqual(wrongPassword.body, unknown.body);
    });

    it('blocks login with 429 after the configured number of attempts', async () => {
      const {email} = await register();
      const limit = 2;
      const {AppModule} = await import('../src/app.module');
      const {configureApplication} =
        await import('../src/bootstrap/configure-application');
      const {validateEnvironment} = await import('../src/config/environment');
      const config = new ConfigService(
        validateEnvironment({...process.env, AUTH_RATE_LIMIT: limit}),
      );
      const module = await Test.createTestingModule({imports: [AppModule]})
        .overrideProvider(ConfigService)
        .useValue(config)
        .compile();
      const limitedApp = module.createNestApplication();
      try {
        configureApplication(limitedApp);
        await limitedApp.init();
        const api = request(limitedApp.getHttpServer());
        const body = {user: {email, password}};
        for (let attempt = 0; attempt < limit; attempt++) {
          await api.post('/api/users/login').send(body).expect(200);
        }
        const blocked = await api
          .post('/api/users/login')
          .set('Accept-Language', 'vi')
          .send(body)
          .expect(429);
        assert.ok(Number(blocked.headers['retry-after']) > 0);
        assert.deepEqual(blocked.body, {
          errors: {body: ['Quá nhiều yêu cầu. Vui lòng thử lại sau.']},
        });
      } finally {
        await limitedApp.close();
      }
    });

    it('localizes authentication errors in English and Vietnamese', async () => {
      const {email} = fixture();
      for (const {language, badLogin, missingAuth} of [
        {
          language: 'en',
          badLogin: 'Invalid email or password',
          missingAuth: 'Authentication required',
        },
        {
          language: 'vi-VN, en;q=0.8',
          badLogin: 'Email hoặc mật khẩu không đúng',
          missingAuth: 'Bạn cần đăng nhập để thực hiện thao tác này',
        },
      ]) {
        const loginError = await request(server())
          .post('/api/users/login')
          .set('Accept-Language', language)
          .send({user: {email, password}})
          .expect(401);
        assert.deepEqual(loginError.body, {errors: {body: [badLogin]}});
        const currentError = await request(server())
          .get('/api/user')
          .set('Accept-Language', language)
          .expect(401);
        assert.deepEqual(currentError.body, {errors: {body: [missingAuth]}});
      }
    });

    it('rejects malformed login envelopes and unknown fields with 422', async () => {
      for (const body of [
        {},
        {user: null},
        {user: []},
        {user: {email: null, password}},
        {user: {email: 'not-an-email', password}},
        {user: {email: fixture().email, password: null}},
        {user: {email: fixture().email, password, role: 'admin'}},
      ]) {
        assertError(
          await request(server()).post('/api/users/login').send(body),
          422,
        );
      }
    });

    it('gets the current account without refreshing or changing the original token', async () => {
      const user = await register();
      for (const scheme of ['Token', 'Bearer']) {
        const response = await request(server())
          .get('/api/user')
          .set('Authorization', `${scheme} ${user.token}`)
          .expect(200);
        assert.equal(assertUser(response, user).token, user.token);
      }
    });

    it('rejects missing and malformed authorization headers', async () => {
      assertError(await request(server()).get('/api/user'), 401);
      for (const header of [
        'Basic credentials',
        'Token',
        'Token one two',
        'Token not-a-jwt',
      ]) {
        assertError(
          await request(server()).get('/api/user').set('Authorization', header),
          401,
        );
      }
    });

    it('distinguishes JWT verification failures from verified JWTs with invalid claims', async () => {
      const user = await register();
      const payload = {sub: claims(user.token).sub, jti: randomUUID()};
      const verificationFailures = await Promise.all([
        jwt.signAsync(payload, {secret: randomUUID().repeat(2)}),
        jwt.signAsync(payload, {expiresIn: -1}),
        jwt.signAsync(payload, {algorithm: 'HS384'}),
        jwt.signAsync(payload, {issuer: 'untrusted-issuer'}),
        jwt.signAsync(payload, {audience: 'different-api'}),
      ]);
      for (const token of verificationFailures) {
        const response = await request(server())
          .get('/api/user')
          .set('Authorization', `Token ${token}`)
          .set('Accept-Language', 'en')
          .expect(401);
        assert.deepEqual(response.body, {
          errors: {body: ['Invalid or expired token']},
        });
      }

      const invalidClaims = await Promise.all([
        jwt.signAsync({...payload, jti: 'invalid-session-id'}),
        jwt.signAsync({...payload, sub: 'not-a-uuid'}),
      ]);
      for (const token of invalidClaims) {
        await jwt.verifyAsync(token);
        const response = await request(server())
          .get('/api/user')
          .set('Authorization', `Token ${token}`)
          .set('Accept-Language', 'en')
          .expect(401);
        assert.deepEqual(response.body, {
          errors: {body: ['Invalid token claims']},
        });
      }
    });

    it('logs out by blacklisting only that JWT until its original expiration', async () => {
      const user = await register();
      const payload = claims(user.token);
      const key = `auth:revoked:${payload.jti}`;
      assert.ok(redis);
      assert.equal(await redis.exists(key), 0);
      const response = await request(server())
        .post('/api/users/logout')
        .set('Authorization', `Token ${user.token}`)
        .expect(204);
      assert.equal(response.text, '');
      assert.equal(await redis.exists(key), 1);
      const remaining = payload.exp - Math.floor(Date.now() / 1000);
      const ttl = await redis.ttl(key);
      assert.ok(
        ttl > 0 && Math.abs(ttl - remaining) <= 2,
        `Unexpected blacklist TTL: ${ttl}`,
      );
      assertError(
        await request(server())
          .get('/api/user')
          .set('Authorization', `Token ${user.token}`),
        401,
      );
      assertError(
        await request(server())
          .post('/api/users/logout')
          .set('Authorization', `Token ${user.token}`),
        401,
      );
    });

    it('issues unique sessions within the same second and preserves a second session after logout', async (context) => {
      const user = await register();
      const now = Date.now();
      const clock = context.mock.method(Date, 'now', () => now);
      let first: UserView;
      let second: UserView;
      try {
        [first, second] = await Promise.all([login(user), login(user)]);
      } finally {
        clock.mock.restore();
      }
      const firstClaims = claims(first.token);
      const secondClaims = claims(second.token);
      assert.equal(firstClaims.iat, secondClaims.iat);
      assert.notEqual(firstClaims.jti, secondClaims.jti);
      assert.notEqual(first.token, second.token);
      await request(server())
        .post('/api/users/logout')
        .set('Authorization', `Token ${first.token}`)
        .expect(204);
      assertError(
        await request(server())
          .get('/api/user')
          .set('Authorization', `Token ${first.token}`),
        401,
      );
      const response = await request(server())
        .get('/api/user')
        .set('Authorization', `Token ${second.token}`)
        .expect(200);
      assert.equal(assertUser(response, user).token, second.token);
    });

    it('rejects a valid JWT after its account has been deleted from PostgreSQL', async () => {
      const user = await register();
      await users.delete({id: claims(user.token).sub});
      assertError(
        await request(server())
          .get('/api/user')
          .set('Authorization', `Token ${user.token}`),
        401,
      );
    });

    it('requires authentication for logout', async () => {
      assertError(await request(server()).post('/api/users/logout'), 401);
    });
  },
);
