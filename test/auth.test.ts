import 'reflect-metadata';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp, readdir, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {after, afterEach, before, beforeEach, describe, it} from 'node:test';
import type {INestApplication} from '@nestjs/common';
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
const attachmentPrefix = '/api/attachments/';
const redAvatar = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==',
  'base64',
);
const blueAvatar = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYPj/HwADAgH/5ncLrgAAAABJRU5ErkJggg==',
  'base64',
);

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
    let avatarDirectory: string | undefined;
    const avatarDirectoryPrefix = resolve(tmpdir(), 'realworld-auth-avatars-');
    const originalAvatarDirectory = process.env.AVATAR_UPLOAD_DIR;
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

    function updateUser(token: string, fields: Record<string, unknown>) {
      return request(server())
        .put('/api/user')
        .set('Authorization', `Token ${token}`)
        .send({user: fields});
    }

    async function truncateUserFixtures(): Promise<void> {
      if (!database?.isInitialized) return;
      // Revalidate the explicit service targets immediately before destructive SQL.
      const {databaseUrl} = configureTestServices();
      assert.equal(database.options.type, 'postgres');
      assert.equal((database.options as {url?: string}).url, databaseUrl);
      await database.query(
        'TRUNCATE TABLE public.attachments, public.follows, public.users',
      );
    }

    before(
      async () => {
        const services = configureTestServices();
        avatarDirectory = await mkdtemp(avatarDirectoryPrefix);
        process.env.AVATAR_UPLOAD_DIR = avatarDirectory;
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

    beforeEach(truncateUserFixtures);

    afterEach(async () => {
      try {
        if (redis?.isReady && keysCreatedByThisSuite.size) {
          await redis.del([...keysCreatedByThisSuite]);
        }
      } finally {
        keysCreatedByThisSuite.clear();
        await truncateUserFixtures();
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

    after(async () => {
      if (originalAvatarDirectory === undefined) {
        delete process.env.AVATAR_UPLOAD_DIR;
      } else {
        process.env.AVATAR_UPLOAD_DIR = originalAvatarDirectory;
      }
      if (avatarDirectory) {
        const directory = resolve(avatarDirectory);
        assert.ok(directory.startsWith(avatarDirectoryPrefix));
        assert.match(
          directory.slice(avatarDirectoryPrefix.length),
          /^[a-z0-9]+$/i,
        );
        await rm(directory, {recursive: true, force: true});
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

    it('rejects forged, expired, wrong-algorithm, and invalid-claim JWTs', async () => {
      const user = await register();
      const payload = {sub: claims(user.token).sub, jti: randomUUID()};
      const invalid = await Promise.all([
        jwt.signAsync(payload, {secret: randomUUID().repeat(2)}),
        jwt.signAsync(payload, {expiresIn: -1}),
        jwt.signAsync(payload, {algorithm: 'HS384'}),
        jwt.signAsync(payload, {issuer: 'untrusted-issuer'}),
        jwt.signAsync(payload, {audience: 'different-api'}),
        jwt.signAsync({...payload, jti: 'invalid-session-id'}),
        jwt.signAsync({...payload, sub: 'not-a-uuid'}),
      ]);
      for (const token of invalid) {
        assertError(
          await request(server())
            .get('/api/user')
            .set('Authorization', `Token ${token}`),
          401,
        );
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

    it('updates only supplied account fields, hashes the new password and preserves the original token', async () => {
      const user = await register();
      const id = claims(user.token).sub;
      const selection = {where: {id}, select: {id: true, passwordHash: true}};
      const before = await users.findOneOrFail(selection);
      const profile = {
        bio: 'I write tutorials.',
        image: 'https://example.com/avatar.png',
      };
      const profileEdit = await updateUser(user.token, profile).expect(200);
      assert.deepEqual(profileEdit.body, {user: {...user, ...profile}});

      const email = fixture().email;
      const newPassword = 'Changed-training-password-123!';
      const credentialsEdit = await updateUser(user.token, {
        email: ` ${email.toUpperCase()} `,
        password: newPassword,
      }).expect(200);
      assert.deepEqual(credentialsEdit.body, {
        user: {...user, ...profile, email},
      });
      const stored = await users.findOneOrFail(selection);
      assert.match(
        stored.passwordHash,
        /^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/,
      );
      assert.notEqual(stored.passwordHash, before.passwordHash);

      const cleared = await updateUser(user.token, {
        bio: null,
        image: null,
      }).expect(200);
      assert.deepEqual(cleared.body, {user: {...user, email}});
      const current = await request(server())
        .get('/api/user')
        .set('Authorization', `Token ${user.token}`)
        .expect(200);
      assert.deepEqual(current.body, cleared.body);
      const oldLogin = await request(server())
        .post('/api/users/login')
        .send({user: {email, password}});
      assertError(oldLogin, 401);
      const newLogin = await request(server())
        .post('/api/users/login')
        .send({user: {email, password: newPassword}})
        .expect(200);
      assertUser(newLogin, {...user, email});
    });

    it('rejects unauthenticated updates and invalid or duplicate credentials without changing the account', async () => {
      assertError(
        await request(server())
          .put('/api/user')
          .send({user: {bio: 'Unauthorized'}}),
        401,
      );
      const user = await register();
      const other = await register();
      for (const fields of [
        {email: null},
        {username: null},
        {password: null},
        {email: ` ${other.email.toUpperCase()} `},
        {username: other.username},
      ]) {
        assertError(
          await updateUser(user.token, {...fields, bio: 'Must not be saved'}),
          422,
        );
      }
      const current = await request(server())
        .get('/api/user')
        .set('Authorization', `Token ${user.token}`)
        .expect(200);
      assert.deepEqual(current.body, {user});
    });

    it('returns only public profile fields and resolves the follow direction for the authenticated viewer', async () => {
      const subject = await register();
      const viewer = await register();
      const subjectId = claims(subject.token).sub;
      const viewerId = claims(viewer.token).sub;
      const publicFields = {
        bio: 'I write tutorials.',
        image: 'https://example.com/avatar.png',
      };
      await users.update({id: subjectId}, publicFields);
      assert.ok(database);
      await database.query(
        'INSERT INTO public.follows (follower_id, following_id) VALUES ($1, $2)',
        [viewerId, subjectId],
      );

      const path = `/api/profiles/${subject.username}`;
      const profile = {username: subject.username, ...publicFields};
      const guest = await request(server()).get(path).expect(200);
      assert.deepEqual(guest.body, {profile: {...profile, following: false}});
      const follower = await request(server())
        .get(path)
        .set('Authorization', `Token ${viewer.token}`)
        .expect(200);
      assert.deepEqual(follower.body, {profile: {...profile, following: true}});
      const reverse = await request(server())
        .get(`/api/profiles/${viewer.username}`)
        .set('Authorization', `Token ${subject.token}`)
        .expect(200);
      assert.equal(reverse.body.profile.following, false);
    });

    it('returns 404 for a missing profile and rejects invalid or revoked credentials', async () => {
      assertError(
        await request(server()).get(`/api/profiles/${fixture().username}`),
        404,
      );
      const user = await register();
      const path = `/api/profiles/${user.username}`;
      assertError(
        await request(server())
          .get(path)
          .set('Authorization', 'Token not-a-jwt'),
        401,
      );
      await request(server())
        .post('/api/users/logout')
        .set('Authorization', `Token ${user.token}`)
        .expect(204);
      assertError(
        await request(server())
          .get(path)
          .set('Authorization', `Token ${user.token}`),
        401,
      );
    });

    it('follows and unfollows a profile idempotently and updates the viewer state', async () => {
      const subject = await register();
      const viewer = await register();
      const path = `/api/profiles/${subject.username}`;
      const authorization = `Token ${viewer.token}`;
      for (const [method, following] of [
        ['post', true],
        ['delete', false],
      ] as const) {
        const profile = {
          username: subject.username,
          bio: null,
          image: null,
          following,
        };
        for (let attempt = 0; attempt < 2; attempt++) {
          const response = await request(server())
            [method](`${path}/follow`)
            .set('Authorization', authorization)
            .expect(200);
          assert.deepEqual(response.body, {profile});
        }
        const current = await request(server())
          .get(path)
          .set('Authorization', authorization)
          .expect(200);
        assert.deepEqual(current.body, {profile});
      }
    });

    it('rejects guest, self, and missing-target follow requests', async () => {
      const user = await register();
      const self = `/api/profiles/${user.username}/follow`;
      const missing = `/api/profiles/${fixture().username}/follow`;
      for (const method of ['post', 'delete'] as const) {
        assertError(await request(server())[method](self), 401);
        assertError(
          await request(server())
            [method](self)
            .set('Authorization', `Token ${user.token}`),
          422,
        );
        assertError(
          await request(server())
            [method](missing)
            .set('Authorization', `Token ${user.token}`),
          404,
        );
      }
    });

    it('stores, serves privately, replaces, and removes an uploaded avatar', async () => {
      assert.ok(database);
      assert.ok(avatarDirectory);
      const owner = await register();
      const other = await register();
      const authorization = `Token ${owner.token}`;
      const bio = 'I write tutorials.';
      const uploaded = await request(server())
        .put('/api/user')
        .set('Authorization', authorization)
        .field('user', JSON.stringify({bio}))
        .attach('avatar', redAvatar, {
          filename: 'avatar.png',
          contentType: 'image/png',
        })
        .expect(200);
      const image = (uploaded.body.user as UserView).image;
      assert.ok(image && image.startsWith(attachmentPrefix));
      const id = image.slice(attachmentPrefix.length);
      assert.match(id, uuidPattern);
      assert.deepEqual(uploaded.body, {user: {...owner, bio, image}});
      const rows = await database.query(
        'SELECT owner_type, owner_id, url, file_name, file_type, file_size FROM public.attachments WHERE id = $1',
        [id],
      );
      assert.equal(rows.length, 1);
      const {file_name: fileName, ...metadata} = rows[0];
      assert.equal(fileName, `${id}.png`);
      assert.deepEqual(metadata, {
        owner_type: 'user',
        owner_id: claims(owner.token).sub,
        url: image,
        file_type: 'image/png',
        file_size: redAvatar.length,
      });
      assert.deepEqual(await readdir(avatarDirectory), [fileName]);

      const duplicateEmail = await request(server())
        .put('/api/user')
        .set('Authorization', authorization)
        .field('user', JSON.stringify({email: other.email}))
        .attach('avatar', blueAvatar, {
          filename: 'replacement.png',
          contentType: 'image/png',
        });
      assertError(duplicateEmail, 422);
      assert.deepEqual(
        await database.query('SELECT id FROM public.attachments'),
        [{id}],
      );
      assert.deepEqual(await readdir(avatarDirectory), [fileName]);

      const download = await request(server())
        .get(image)
        .set('Authorization', authorization)
        .expect('Content-Type', /image\/png/)
        .expect('Cache-Control', /no-store/)
        .expect(200);
      assert.deepEqual(download.body, redAvatar);
      assertError(await request(server()).get(image), 401);
      assertError(
        await request(server())
          .get(image)
          .set('Authorization', `Token ${other.token}`),
        404,
      );
      assertError(
        await request(server())
          .get(`${attachmentPrefix}${randomUUID()}`)
          .set('Authorization', authorization),
        404,
      );

      const replacement = await request(server())
        .put('/api/user')
        .set('Authorization', authorization)
        .attach('avatar', blueAvatar, {
          filename: 'replacement.png',
          contentType: 'image/png',
        })
        .expect(200);
      const newImage = (replacement.body.user as UserView).image;
      assert.ok(newImage && newImage.startsWith(attachmentPrefix));
      assert.match(newImage.slice(attachmentPrefix.length), uuidPattern);
      assert.notEqual(newImage, image);
      assert.deepEqual(replacement.body, {
        user: {...owner, bio, image: newImage},
      });
      assertError(
        await request(server()).get(image).set('Authorization', authorization),
        404,
      );
      const updatedDownload = await request(server())
        .get(newImage)
        .set('Authorization', authorization)
        .expect(200);
      assert.deepEqual(updatedDownload.body, blueAvatar);
      const remainingFiles = await readdir(avatarDirectory);
      assert.equal(remainingFiles.length, 1);
      assert.equal(remainingFiles.includes(fileName), false);

      const cleared = await updateUser(owner.token, {image: null}).expect(200);
      assert.deepEqual(cleared.body, {user: {...owner, bio, image: null}});
      assertError(
        await request(server())
          .get(newImage)
          .set('Authorization', authorization),
        404,
      );
      assert.deepEqual(
        await database.query('SELECT id FROM public.attachments'),
        [],
      );
      assert.deepEqual(await readdir(avatarDirectory), []);
    });

    it('rejects invalid avatar bytes and malformed multipart user JSON without saving an attachment', async () => {
      assert.ok(database);
      assert.ok(avatarDirectory);
      const user = await register();
      const authorization = `Token ${user.token}`;
      const filesBefore = await readdir(avatarDirectory);
      const badImage = await request(server())
        .put('/api/user')
        .set('Authorization', authorization)
        .attach('avatar', Buffer.from('not an image'), {
          filename: 'invalid.png',
          contentType: 'image/png',
        });
      assertError(badImage, 422);
      const badJson = await request(server())
        .put('/api/user')
        .set('Authorization', authorization)
        .field('user', '{"bio":')
        .attach('avatar', redAvatar, {
          filename: 'avatar.png',
          contentType: 'image/png',
        });
      assertError(badJson, 422);
      const oversized = await request(server())
        .put('/api/user')
        .set('Authorization', authorization)
        .attach('avatar', Buffer.alloc(2 * 1024 * 1024 + 1), {
          filename: 'oversized.png',
          contentType: 'image/png',
        });
      assertError(oversized, 413);
      const current = await request(server())
        .get('/api/user')
        .set('Authorization', authorization)
        .expect(200);
      assert.deepEqual(current.body, {user});
      assert.deepEqual(
        await database.query('SELECT id FROM public.attachments'),
        [],
      );
      assert.deepEqual(await readdir(avatarDirectory), filesBefore);
    });
  },
);
