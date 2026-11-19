import 'reflect-metadata';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {after, afterEach, before, beforeEach, describe, it} from 'node:test';
import type {INestApplication} from '@nestjs/common';
import {Test} from '@nestjs/testing';
import request from 'supertest';
import {DataSource} from 'typeorm';
import {configureTestServices, truncateTestFixtures} from './support/services';

const articlePath = '/api/articles';
const sampleArticle = {
  title: 'Learning NestJS',
  description: 'A short practical guide',
  body: '  The first example.\n\nThe second example.  ',
  tagList: ['typescript', 'nestjs'],
};

interface TestUser {
  username: string;
  token: string;
}

interface ArticleView {
  slug: string;
  title: string;
  description: string;
  body: string;
  tagList: string[];
  createdAt: string;
  updatedAt: string;
  favorited: boolean;
  favoritesCount: number;
  author: {
    username: string;
    bio: string | null;
    image: string | null;
    following: boolean;
  };
}

function detailPath(slug: string): string {
  return `${articlePath}/${encodeURIComponent(slug)}`;
}

function summary(article: ArticleView): Omit<ArticleView, 'body'> {
  const summary = {...article};
  Reflect.deleteProperty(summary, 'body');
  return summary;
}

describe('Articles with PostgreSQL and Redis', {concurrency: false}, () => {
  let app: INestApplication | undefined;
  let database: DataSource | undefined;

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
          username: `writer_${suffix}`,
          email: `${suffix}@example.test`,
          password: 'Training-password-123!',
        },
      })
      .expect(201);
    return response.body.user as TestUser;
  }

  async function publish(
    author: TestUser,
    article: Partial<typeof sampleArticle> = {},
  ): Promise<ArticleView> {
    const response = await api()
      .post(articlePath)
      .set('Authorization', `Token ${author.token}`)
      .send({article: {...sampleArticle, ...article}})
      .expect(201);
    return response.body.article as ArticleView;
  }

  before(
    async () => {
      configureTestServices();
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
    },
    {timeout: 30000},
  );

  beforeEach(() => truncateTestFixtures(database));
  afterEach(() => truncateTestFixtures(database));
  after(async () => {
    if (app) await app.close();
  });

  it('creates an article with a unique slug and the full RealWorld response', async () => {
    const author = await register();
    const article = await publish(author, {
      title: `  ${sampleArticle.title}  `,
    });
    assert.ok(article.slug);
    assert.ok(Number.isFinite(Date.parse(article.createdAt)));
    assert.ok(Number.isFinite(Date.parse(article.updatedAt)));
    assert.deepEqual(article, {
      ...sampleArticle,
      slug: article.slug,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
      favorited: false,
      favoritesCount: 0,
      author: {
        username: author.username,
        bio: null,
        image: null,
        following: false,
      },
    });
    const duplicateTitle = await publish(author, {tagList: []});
    assert.notEqual(duplicateTitle.slug, article.slug);
    assert.deepEqual(duplicateTitle.tagList, []);
    const stored = await api().get(detailPath(article.slug)).expect(200);
    assert.deepEqual(stored.body, {article});
  });

  it('returns a public detail and resolves following only for the authenticated viewer', async () => {
    const author = await register();
    const viewer = await register();
    const article = await publish(author);
    const path = detailPath(article.slug);
    await api()
      .post(`/api/profiles/${author.username}/follow`)
      .set('Authorization', `Token ${viewer.token}`)
      .expect(200);

    const publicResponse = await api().get(path).expect(200);
    assert.deepEqual(publicResponse.body, {article});
    const authenticatedResponse = await api()
      .get(path)
      .set('Authorization', `Token ${viewer.token}`)
      .expect(200);
    assert.deepEqual(authenticatedResponse.body, {
      article: {...article, author: {...article.author, following: true}},
    });
    await api().get(path).set('Authorization', 'Token invalid').expect(401);
    await api().get(detailPath('missing-article')).expect(404);
  });

  it('filters, orders, and paginates public summaries while counting every matching article', async () => {
    assert.ok(database);
    const author = await register();
    const viewer = await register();
    const older = await publish(author, {title: 'Older NestJS guide'});
    const newer = await publish(author, {title: 'Newer NestJS guide'});
    const unrelated = await publish(viewer, {
      title: 'Different topic',
      tagList: ['database'],
    });
    for (const [article, createdAt] of [
      [older, '2020-01-01T00:00:00.000Z'],
      [newer, '2020-01-02T00:00:00.000Z'],
      [unrelated, '2020-01-03T00:00:00.000Z'],
    ] as const) {
      await database.query(
        'UPDATE public.articles SET created_at = $1 WHERE slug = $2',
        [createdAt, article.slug],
      );
      article.createdAt = createdAt;
    }
    const all = await api().get(articlePath).expect(200);
    assert.deepEqual(all.body, {
      articles: [unrelated, newer, older].map(summary),
      articlesCount: 3,
    });
    const tagged = await api()
      .get(articlePath)
      .query({tag: 'nestjs', limit: 1, offset: 1})
      .expect(200);
    assert.deepEqual(tagged.body, {
      articles: [summary(older)],
      articlesCount: 2,
    });
    const authored = await api()
      .get(articlePath)
      .query({author: author.username, limit: 1})
      .expect(200);
    assert.deepEqual(authored.body, {
      articles: [summary(newer)],
      articlesCount: 2,
    });
    const combined = await api()
      .get(articlePath)
      .query({tag: 'nestjs', author: viewer.username})
      .expect(200);
    assert.deepEqual(combined.body, {articles: [], articlesCount: 0});
  });

  it('allows only the author to edit and delete and resolves the slug after a title change', async () => {
    const author = await register();
    const outsider = await register();
    const article = await publish(author);
    const path = detailPath(article.slug);
    const authorization = `Token ${author.token}`;
    const update = {article: {description: 'New description'}};
    await api().put(path).send(update).expect(401);
    await api()
      .put(path)
      .set('Authorization', 'Token invalid')
      .send(update)
      .expect(401);
    await api()
      .put(path)
      .set('Authorization', `Token ${outsider.token}`)
      .send(update)
      .expect(403);
    await api().delete(path).expect(401);
    await api()
      .delete(path)
      .set('Authorization', `Token ${outsider.token}`)
      .expect(403);

    const edited = await api()
      .put(path)
      .set('Authorization', authorization)
      .send(update)
      .expect(200);
    assert.deepEqual(edited.body, {
      article: {
        ...article,
        description: update.article.description,
        updatedAt: edited.body.article.updatedAt,
      },
    });
    const title = 'A new title';
    const renamed = await api()
      .put(path)
      .set('Authorization', authorization)
      .send({article: {title}})
      .expect(200);
    const replacement = renamed.body.article as ArticleView;
    assert.equal(replacement.title, title);
    assert.notEqual(replacement.slug, article.slug);
    const newPath = detailPath(replacement.slug);
    await api().get(path).expect(404);
    await api()
      .put(path)
      .set('Authorization', authorization)
      .send(update)
      .expect(404);
    await api().delete(path).set('Authorization', authorization).expect(404);
    const retrieved = await api().get(newPath).expect(200);
    assert.deepEqual(retrieved.body, renamed.body);
    const deleted = await api()
      .delete(newPath)
      .set('Authorization', authorization)
      .expect(204);
    assert.equal(deleted.text, '');
    await api().get(newPath).expect(404);
  });

  it('rejects malformed article envelopes, updates, and pagination with 422', async () => {
    const author = await register();
    const authorization = `Token ${author.token}`;
    await api().post(articlePath).send({article: sampleArticle}).expect(401);
    for (const article of [
      null,
      [],
      {...sampleArticle, body: '  '},
      {...sampleArticle, tagList: ['']},
      {...sampleArticle, slug: 'custom'},
    ]) {
      await api()
        .post(articlePath)
        .set('Authorization', authorization)
        .send({article})
        .expect(422);
    }
    const created = await publish(author);
    for (const article of [
      {title: null},
      {body: '  '},
      {tagList: ['new-tag']},
    ]) {
      await api()
        .put(detailPath(created.slug))
        .set('Authorization', authorization)
        .send({article})
        .expect(422);
    }
    for (const query of [
      'limit=0',
      'limit=101',
      'limit=1.5',
      'offset=-1',
      'limit=1&limit=2',
    ]) {
      await api().get(`${articlePath}?${query}`).expect(422);
    }
    const current = await api().get(detailPath(created.slug)).expect(200);
    assert.deepEqual(current.body, {article: created});
  });

  it('feeds followed authors in newest-first pages with a full total and no article body', async () => {
    assert.ok(database);
    const author = await register();
    const outsider = await register();
    const viewer = await register();
    const older = await publish(author, {title: 'Older followed article'});
    const newer = await publish(author, {title: 'Newer followed article'});
    await publish(outsider, {title: 'Unfollowed author'});
    for (const [article, createdAt] of [
      [older, '2020-01-01T00:00:00.000Z'],
      [newer, '2020-01-02T00:00:00.000Z'],
    ] as const) {
      await database.query(
        'UPDATE public.articles SET created_at = $1 WHERE slug = $2',
        [createdAt, article.slug],
      );
      article.createdAt = createdAt;
    }
    const feedPath = `${articlePath}/feed`;
    const authorization = `Token ${viewer.token}`;
    await api().get(feedPath).expect(401);
    await api().get(feedPath).set('Authorization', 'Token invalid').expect(401);
    const empty = await api()
      .get(feedPath)
      .set('Authorization', authorization)
      .expect(200);
    assert.deepEqual(empty.body, {articles: [], articlesCount: 0});
    await api()
      .post(`/api/profiles/${author.username}/follow`)
      .set('Authorization', authorization)
      .expect(200);
    await api()
      .post(`${detailPath(newer.slug)}/favorite`)
      .set('Authorization', authorization)
      .expect(200);
    const expected = [newer, older].map((article) => ({
      ...summary(article),
      favorited: article.slug === newer.slug,
      favoritesCount: article.slug === newer.slug ? 1 : 0,
      author: {...article.author, following: true},
    }));
    const feed = await api()
      .get(feedPath)
      .set('Authorization', authorization)
      .expect(200);
    assert.deepEqual(feed.body, {articles: expected, articlesCount: 2});
    const page = await api()
      .get(feedPath)
      .set('Authorization', authorization)
      .query({limit: 1, offset: 1})
      .expect(200);
    assert.deepEqual(page.body, {
      articles: expected.slice(1),
      articlesCount: 2,
    });
    await api()
      .get(feedPath)
      .set('Authorization', authorization)
      .query({limit: 101})
      .expect(422);
  });

  it('combines favorited, tag and author filters and keeps aggregate counts independent of the viewer', async () => {
    assert.ok(database);
    const author = await register();
    const viewer = await register();
    const older = await publish(author, {title: 'First favorite'});
    const newer = await publish(author, {title: 'Second favorite'});
    await publish(viewer, {title: 'Unrelated article', tagList: ['database']});
    for (const [article, createdAt] of [
      [older, '2020-01-01T00:00:00.000Z'],
      [newer, '2020-01-02T00:00:00.000Z'],
    ] as const) {
      await database.query(
        'UPDATE public.articles SET created_at = $1 WHERE slug = $2',
        [createdAt, article.slug],
      );
      article.createdAt = createdAt;
      await api()
        .post(`${detailPath(article.slug)}/favorite`)
        .set('Authorization', `Token ${viewer.token}`)
        .expect(200);
    }
    await api()
      .post(`${detailPath(newer.slug)}/favorite`)
      .set('Authorization', `Token ${author.token}`)
      .expect(200);
    const filter = {
      favorited: viewer.username,
      tag: 'nestjs',
      author: author.username,
    };
    const expected = [newer, older].map((article) => ({
      ...summary(article),
      favoritesCount: article.slug === newer.slug ? 2 : 1,
    }));
    const guest = await api().get(articlePath).query(filter).expect(200);
    assert.deepEqual(guest.body, {articles: expected, articlesCount: 2});
    const page = await api()
      .get(articlePath)
      .query({...filter, limit: 1, offset: 1})
      .set('Authorization', `Token ${viewer.token}`)
      .expect(200);
    assert.deepEqual(page.body, {
      articles: [{...expected[1], favorited: true}],
      articlesCount: 2,
    });
    const otherViewer = await api()
      .get(articlePath)
      .query(filter)
      .set('Authorization', `Token ${author.token}`)
      .expect(200);
    assert.deepEqual(otherViewer.body, {
      articles: expected.map((article) => ({
        ...article,
        favorited: article.slug === newer.slug,
      })),
      articlesCount: 2,
    });
    for (const query of [
      {...filter, tag: 'missing-tag'},
      {...filter, author: viewer.username},
      {favorited: `missing_${randomUUID()}`},
    ]) {
      const empty = await api().get(articlePath).query(query).expect(200);
      assert.deepEqual(empty.body, {articles: [], articlesCount: 0});
    }
  });

  it('favorites and unfavorites idempotently, enforces authentication and cascades favorites on deletion', async () => {
    assert.ok(database);
    const author = await register();
    const viewer = await register();
    const article = await publish(author);
    const path = `${detailPath(article.slug)}/favorite`;
    const authorization = `Token ${viewer.token}`;
    for (const method of ['post', 'delete'] as const) {
      await api()[method](path).expect(401);
      await api()
        [method](path)
        .set('Authorization', 'Token invalid')
        .expect(401);
      await api()
        [method](`${detailPath('missing-article')}/favorite`)
        .set('Authorization', authorization)
        .expect(404);
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      const favorited = await api()
        .post(path)
        .set('Authorization', authorization)
        .expect(200);
      assert.deepEqual(favorited.body, {
        article: {...article, favorited: true, favoritesCount: 1},
      });
    }
    const secondFavorite = await api()
      .post(path)
      .set('Authorization', `Token ${author.token}`)
      .expect(200);
    assert.equal(secondFavorite.body.article.favoritesCount, 2);
    const description = 'Edited while favorited';
    const edited = await api()
      .put(detailPath(article.slug))
      .set('Authorization', `Token ${author.token}`)
      .send({article: {description}})
      .expect(200);
    assert.equal(edited.body.article.favorited, true);
    assert.equal(edited.body.article.favoritesCount, 2);
    article.description = description;
    article.updatedAt = edited.body.article.updatedAt;
    for (let attempt = 0; attempt < 2; attempt++) {
      const unfavorited = await api()
        .delete(path)
        .set('Authorization', authorization)
        .expect(200);
      assert.deepEqual(unfavorited.body, {
        article: {...article, favoritesCount: 1},
      });
    }
    const ownerDetail = await api()
      .get(detailPath(article.slug))
      .set('Authorization', `Token ${author.token}`)
      .expect(200);
    assert.equal(ownerDetail.body.article.favorited, true);
    assert.equal(ownerDetail.body.article.favoritesCount, 1);
    await api()
      .delete(detailPath(article.slug))
      .set('Authorization', `Token ${author.token}`)
      .expect(204);
    const remaining = await database.query(
      'SELECT COUNT(*)::int AS count FROM public.article_favorites',
    );
    assert.deepEqual(remaining, [{count: 0}]);
  });

  it('exposes a private author avatar only to its owner across article responses', async () => {
    assert.ok(database);
    const author = await register();
    const viewer = await register();
    const image = `/api/attachments/${randomUUID()}`;
    await database.query(
      'UPDATE public.users SET image = $1 WHERE username = $2',
      [image, author.username],
    );
    const article = await publish(author);
    assert.equal(article.author.image, image);
    const path = detailPath(article.slug);
    const guest = await api().get(path).expect(200);
    assert.equal(guest.body.article.author.image, null);
    const owner = await api()
      .get(path)
      .set('Authorization', `Token ${author.token}`)
      .expect(200);
    assert.equal(owner.body.article.author.image, image);
    const outsider = await api()
      .get(path)
      .set('Authorization', `Token ${viewer.token}`)
      .expect(200);
    assert.equal(outsider.body.article.author.image, null);
    const guestList = await api().get(articlePath).expect(200);
    assert.equal(guestList.body.articles[0].author.image, null);
    await api()
      .post(`/api/profiles/${author.username}/follow`)
      .set('Authorization', `Token ${viewer.token}`)
      .expect(200);
    const feed = await api()
      .get(`${articlePath}/feed`)
      .set('Authorization', `Token ${viewer.token}`)
      .expect(200);
    assert.equal(feed.body.articles[0].author.image, null);
    const favorite = await api()
      .post(`${path}/favorite`)
      .set('Authorization', `Token ${viewer.token}`)
      .expect(200);
    assert.equal(favorite.body.article.author.image, null);
  });
});
