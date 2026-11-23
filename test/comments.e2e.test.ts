import 'reflect-metadata';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {after, afterEach, before, beforeEach, describe, it} from 'node:test';
import type {INestApplication} from '@nestjs/common';
import {JwtService} from '@nestjs/jwt';
import {Test} from '@nestjs/testing';
import {createClient} from 'redis';
import request from 'supertest';
import {DataSource} from 'typeorm';
import {configureTestServices, truncateTestFixtures} from './support/services';

interface TestUser {
  email: string;
  username: string;
  token: string;
}

interface CommentView {
  id: number;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: {
    username: string;
    bio: string | null;
    image: string | null;
    following: boolean;
  };
}

function commentsPath(slug: string): string {
  return `/api/articles/${encodeURIComponent(slug)}/comments`;
}

const password = 'Training-password-123!';

describe('CommentsController E2E', {concurrency: false}, () => {
  let app: INestApplication | undefined;
  let database: DataSource | undefined;
  let redis: ReturnType<typeof createClient> | undefined;
  let articleWriter: TestUser;
  let commenter: TestUser;
  let watcher: TestUser;
  let slug: string;
  const revokedKeys = new Set<string>();

  function api() {
    assert.ok(app);
    return request(app.getHttpServer());
  }

  async function register(): Promise<TestUser> {
    const suffix = randomUUID().replaceAll('-', '');
    const response = await api()
      .post('/api/users')
      .send({
        user: {
          username: `reader_${suffix}`,
          email: `${suffix}@example.test`,
          password,
        },
      })
      .expect(201);
    return response.body.user as TestUser;
  }

  async function publish(author: TestUser): Promise<string> {
    const response = await api()
      .post('/api/articles')
      .set('Authorization', `Token ${author.token}`)
      .send({
        article: {
          title: 'A discussion about NestJS',
          description: 'An article for its comments',
          body: 'Article content',
        },
      })
      .expect(201);
    return response.body.article.slug as string;
  }

  async function comment(
    slug: string,
    author: TestUser,
    body = 'A helpful discussion',
  ): Promise<CommentView> {
    const response = await api()
      .post(commentsPath(slug))
      .set('Authorization', `Token ${author.token}`)
      .send({comment: {body}})
      .expect(201);
    assert.deepEqual(Object.keys(response.body), ['comment']);
    return response.body.comment as CommentView;
  }

  before(
    async () => {
      const services = configureTestServices();
      const {AppModule} = await import('../src/app.module');
      const {configureApplication} =
        await import('../src/bootstrap/configure-application');
      const module = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      app = module.createNestApplication();
      configureApplication(app);
      database = app.get<DataSource>(DataSource);
      await database.runMigrations();
      await app.init();
      redis = createClient({
        url: services.redisUrl,
        socket: {connectTimeout: 2000, reconnectStrategy: false},
        disableOfflineQueue: true,
      });
      redis.on('error', () => {});
      await redis.connect();
    },
    {timeout: 30000},
  );

  beforeEach(async () => {
    await truncateTestFixtures(database);
    articleWriter = await register();
    commenter = await register();
    watcher = await register();
    slug = await publish(articleWriter);
  });
  afterEach(async () => {
    try {
      if (redis?.isReady && revokedKeys.size) await redis.del([...revokedKeys]);
    } finally {
      revokedKeys.clear();
      await truncateTestFixtures(database);
    }
  });
  after(async () => {
    try {
      if (app) await app.close();
    } finally {
      if (redis?.isOpen) await redis.close();
    }
  });

  it('creates a comment with the original body and a sanitized public author', async () => {
    const body = '  The first point.\n\nThe second point.  ';
    const created = await comment(slug, commenter, body);
    assert.ok(Number.isInteger(created.id) && created.id > 0);
    assert.ok(Number.isFinite(Date.parse(created.createdAt)));
    assert.ok(Number.isFinite(Date.parse(created.updatedAt)));
    assert.deepEqual(created, {
      id: created.id,
      body,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
      author: {
        username: commenter.username,
        bio: null,
        image: null,
        following: false,
      },
    });
    const listed = await api().get(commentsPath(slug)).expect(200);
    assert.deepEqual(listed.body, {comments: [created]});
  });

  it('lists only the requested article comments, newest first with a stable ID order', async () => {
    assert.ok(database);
    const otherSlug = await publish(articleWriter);
    const oldest = await comment(slug, commenter, 'Oldest');
    const newer = await comment(slug, commenter, 'Newer');
    const newest = await comment(
      slug,
      commenter,
      'Newest with the same timestamp',
    );
    const unrelated = await comment(otherSlug, commenter, 'Another article');
    await database.query(
      'UPDATE public.comments SET created_at = $1 WHERE id = $2',
      ['2020-01-01T00:00:00.000Z', oldest.id],
    );
    await database.query(
      'UPDATE public.comments SET created_at = $1 WHERE id = ANY($2::int[])',
      ['2020-01-02T00:00:00.000Z', [newer.id, newest.id]],
    );
    const listed = await api().get(commentsPath(slug)).expect(200);
    assert.deepEqual(
      (listed.body.comments as CommentView[]).map(({id}) => id),
      [newest.id, newer.id, oldest.id],
    );
    const other = await api().get(commentsPath(otherSlug)).expect(200);
    assert.deepEqual(other.body, {comments: [unrelated]});
    const emptySlug = await publish(articleWriter);
    assert.deepEqual(
      (await api().get(commentsPath(emptySlug)).expect(200)).body,
      {comments: []},
    );
  });

  it('allows only the comment author to delete and keeps deletion scoped to its article', async () => {
    const otherSlug = await publish(articleWriter);
    const created = await comment(slug, commenter);
    const path = `${commentsPath(slug)}/${created.id}`;
    await api().delete(path).expect(401);
    for (const user of [articleWriter, watcher]) {
      await api()
        .delete(path)
        .set('Authorization', `Token ${user.token}`)
        .expect(403);
    }
    await api()
      .delete(`${commentsPath(otherSlug)}/${created.id}`)
      .set('Authorization', `Token ${commenter.token}`)
      .expect(404);
    assert.deepEqual((await api().get(commentsPath(slug)).expect(200)).body, {
      comments: [created],
    });
    const deleted = await api()
      .delete(path)
      .set('Authorization', `Token ${commenter.token}`)
      .expect(204);
    assert.equal(deleted.text, '');
    await api()
      .delete(path)
      .set('Authorization', `Token ${commenter.token}`)
      .expect(404);
    assert.deepEqual((await api().get(commentsPath(slug)).expect(200)).body, {
      comments: [],
    });
  });

  it('deletes a comment only once when two requests overlap', async () => {
    const writer = await register();
    const slug = await publish(writer);
    const created = await comment(slug, writer);
    const path = `${commentsPath(slug)}/${created.id}`;
    const authorization = `Token ${writer.token}`;

    const responses = await Promise.all([
      api().delete(path).set('Authorization', authorization),
      api().delete(path).set('Authorization', authorization),
    ]);

    assert.deepEqual(responses.map(({status}) => status).sort(), [204, 404]);
    const listed = await api().get(commentsPath(slug)).expect(200);
    assert.deepEqual(listed.body, {comments: []});
  });

  it('requires credentials for creation and rejects invalid tokens on public reads', async () => {
    const path = commentsPath(slug);
    const created = await comment(slug, commenter);
    const payload = {comment: {body: 'A valid comment'}};
    await api().post(path).send(payload).expect(401);
    await api()
      .post(path)
      .set('Authorization', 'Token invalid')
      .send(payload)
      .expect(401);
    await api().get(path).set('Authorization', 'Token invalid').expect(401);
    await api()
      .delete(`${path}/${created.id}`)
      .set('Authorization', 'Token invalid')
      .expect(401);
  });

  it('rejects a logged-out session on create, authenticated list, and delete', async () => {
    assert.ok(app);
    const login = await api()
      .post('/api/users/login')
      .send({user: {email: commenter.email, password}})
      .expect(200);
    const token = login.body.user.token as string;
    const session = {...commenter, token};
    const created = await comment(slug, session);
    const {jti} = app.get(JwtService).verify<{jti: string}>(token);
    revokedKeys.add(`auth:revoked:${jti}`);
    await api()
      .post('/api/users/logout')
      .set('Authorization', `Token ${token}`)
      .expect(204);
    const path = commentsPath(slug);
    await api()
      .post(path)
      .set('Authorization', `Token ${token}`)
      .send({comment: {body: 'A rejected comment'}})
      .expect(401);
    await api().get(path).set('Authorization', `Token ${token}`).expect(401);
    await api()
      .delete(`${path}/${created.id}`)
      .set('Authorization', `Token ${token}`)
      .expect(401);
    assert.deepEqual((await api().get(path).expect(200)).body, {
      comments: [created],
    });
  });

  it('rejects malformed comment envelopes and body values before writing', async () => {
    assert.ok(database);
    const invalid = [
      {},
      {comment: null},
      {comment: []},
      {comment: 'not an object'},
      {comment: {}},
      {comment: {body: null}},
      {comment: {body: 123}},
      {comment: {body: []}},
      {comment: {body: ''}},
      {comment: {body: ' \n\t '}},
      {comment: {body: 'Contains\u0000a null character'}},
      {comment: {body: 'Valid', authorId: randomUUID()}},
      {comment: {body: 'Valid'}, extra: true},
    ];
    for (const payload of invalid) {
      const response = await api()
        .post(commentsPath(slug))
        .set('Authorization', `Token ${commenter.token}`)
        .send(payload)
        .expect(422);
      assert.ok(Array.isArray(response.body.errors.body));
    }
    assert.deepEqual(
      await database.query(
        'SELECT COUNT(*)::int AS count FROM public.comments',
      ),
      [{count: 0}],
    );
  });

  it('distinguishes missing articles and comments from invalid numeric IDs', async () => {
    const missingPath = commentsPath('missing-article');
    const authorization = `Token ${commenter.token}`;
    await api().get(missingPath).expect(404);
    await api()
      .post(missingPath)
      .set('Authorization', authorization)
      .send({comment: {body: 'A valid comment'}})
      .expect(404);
    await api()
      .delete(`${missingPath}/1`)
      .set('Authorization', authorization)
      .expect(404);
    const path = commentsPath(slug);
    await api()
      .delete(`${path}/2147483647`)
      .set('Authorization', authorization)
      .expect(404);
    for (const id of ['invalid', '0', '-1', '1.5', '2147483648']) {
      await api()
        .delete(`${path}/${id}`)
        .set('Authorization', authorization)
        .expect(422);
    }
  });

  it('resolves follow state while exposing a private avatar only to its owner', async () => {
    assert.ok(database);
    const image = `/api/attachments/${randomUUID()}`;
    await database.query(
      'UPDATE public.users SET image = $1 WHERE username = $2',
      [image, commenter.username],
    );
    const created = await comment(slug, commenter);
    assert.equal(created.author.image, image);
    await api()
      .post(`/api/profiles/${commenter.username}/follow`)
      .set('Authorization', `Token ${articleWriter.token}`)
      .expect(200);
    const path = commentsPath(slug);
    const guest = await api().get(path).expect(200);
    assert.deepEqual(guest.body.comments[0].author, {
      username: commenter.username,
      bio: null,
      image: null,
      following: false,
    });
    const follower = await api()
      .get(path)
      .set('Authorization', `Token ${articleWriter.token}`)
      .expect(200);
    assert.equal(follower.body.comments[0].author.image, null);
    assert.equal(follower.body.comments[0].author.following, true);
    const own = await api()
      .get(path)
      .set('Authorization', `Token ${commenter.token}`)
      .expect(200);
    assert.equal(own.body.comments[0].author.image, image);
    assert.equal(own.body.comments[0].author.following, false);
    const externalImage = 'https://example.com/avatar.png';
    await database.query(
      'UPDATE public.users SET image = $1 WHERE username = $2',
      [externalImage, commenter.username],
    );
    const external = await api().get(path).expect(200);
    assert.equal(external.body.comments[0].author.image, externalImage);
  });

  it('publishes the comments routes, security, response types, and integer ID in Swagger', async () => {
    const response = await api().get('/api/docs-json').expect(200);
    const paths = response.body.paths;
    const collection = paths['/api/articles/{slug}/comments'];
    const remove = paths['/api/articles/{slug}/comments/{id}'].delete;
    assert.deepEqual(collection.post.security, [{token: []}]);
    assert.ok(
      collection.get.security.some(
        (security: object) => Object.keys(security).length === 0,
      ),
    );
    assert.ok(
      collection.get.security.some((security: {token?: unknown}) =>
        Array.isArray(security.token),
      ),
    );
    assert.deepEqual(remove.security, [{token: []}]);
    assert.equal(
      collection.post.responses['201'].content['application/json'].schema.$ref,
      '#/components/schemas/CommentResponseDto',
    );
    assert.equal(
      collection.get.responses['200'].content['application/json'].schema.$ref,
      '#/components/schemas/CommentListResponseDto',
    );
    assert.ok(remove.responses['204']);
    const id = remove.parameters.find(
      (parameter: {name: string; in: string}) =>
        parameter.name === 'id' && parameter.in === 'path',
    );
    assert.ok(id);
    assert.equal(id.required, true);
    assert.equal(id.schema.type, 'integer');
    assert.equal(id.schema.minimum, 1);
    assert.equal(id.schema.maximum, 2147483647);
  });

  it('removes the article comments when deleting their parent article', async () => {
    assert.ok(database);
    await comment(slug, commenter);
    await api()
      .delete(`/api/articles/${encodeURIComponent(slug)}`)
      .set('Authorization', `Token ${articleWriter.token}`)
      .expect(204);
    await api().get(commentsPath(slug)).expect(404);
    assert.deepEqual(
      await database.query(
        'SELECT COUNT(*)::int AS count FROM public.comments',
      ),
      [{count: 0}],
    );
  });
});
