import 'reflect-metadata';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {after, before, describe, it} from 'node:test';
import {INestApplication} from '@nestjs/common';
import {Test} from '@nestjs/testing';
import {JwtService} from '@nestjs/jwt';
import request from 'supertest';
import {DataSource} from 'typeorm';
import {configureApp} from '../src/common/configure-app';
import {databaseOptions} from '../src/database/data-source';

describe('RealWorld API against PostgreSQL', () => {
  let app: INestApplication;
  let database: DataSource;
  const suffix = randomUUID().slice(0, 8);
  const alice = {username: `alice-${suffix}`, email: `alice-${suffix}@example.com`, password: 'training-password'};
  const bob = {username: `bob-${suffix}`, email: `bob-${suffix}@example.com`, password: 'training-password'};
  let aliceToken: string;
  let bobToken: string;
  let slug: string;
  let commentId: number;

  before(async () => {
    const url = process.env.TEST_DATABASE_URL;
    if (!url || !new URL(url).pathname.endsWith('_test')) {
      throw new Error('Set TEST_DATABASE_URL to a dedicated database ending in _test');
    }
    process.env.DATABASE_URL = url;
    process.env.JWT_SECRET = randomUUID() + randomUUID();
    database = await new DataSource(databaseOptions(url)).initialize();
    await database.runMigrations();
    const {AppModule} = await import('../src/app.module');
    const module = await Test.createTestingModule({imports: [AppModule]}).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
  });

  after(async () => {
    if (database?.isInitialized) {
      await database.query('DELETE FROM users WHERE username = ANY($1)', [[alice.username, bob.username]]);
      await database.destroy();
    }
    if (app) await app.close();
  });

  it('validates nested registration and requires authentication', async () => {
    await request(app.getHttpServer()).post('/api/users').send({}).expect(422);
    await request(app.getHttpServer()).post('/api/users').send({user: {...alice, email: 'invalid'}}).expect(422);
    const response = await request(app.getHttpServer()).get('/api/user').expect(401);
    assert.ok(Array.isArray(response.body.errors.body));
  });

  it('registers users, rejects duplicates and stores a password hash', async () => {
    const first = await request(app.getHttpServer()).post('/api/users').send({user: alice}).expect(201);
    aliceToken = first.body.user.token;
    assert.equal(first.body.user.email, alice.email);
    assert.equal(first.body.user.password, undefined);
    assert.equal(first.body.user.passwordHash, undefined);
    const second = await request(app.getHttpServer()).post('/api/users').send({user: bob}).expect(201);
    bobToken = second.body.user.token;
    await request(app.getHttpServer()).post('/api/users').send({user: alice}).expect(422);
    const rows = await database.query('SELECT password_hash FROM users WHERE email = $1', [alice.email]);
    assert.notEqual(rows[0].password_hash, alice.password);
    assert.ok(rows[0].password_hash.length > 64);
  });

  it('logs in and rejects invalid credentials and tokens', async () => {
    const login = await request(app.getHttpServer()).post('/api/users/login')
      .send({user: {email: alice.email.toUpperCase(), password: alice.password}}).expect(200);
    aliceToken = login.body.user.token;
    await request(app.getHttpServer()).post('/api/users/login')
      .send({user: {email: alice.email, password: 'wrong-password'}}).expect(401);
    await request(app.getHttpServer()).get('/api/user').set('Authorization', 'Token invalid').expect(401);
    await request(app.getHttpServer()).get('/api/user').set('Authorization', 'Basic abc').expect(401);
  });

  it('gets and updates the current user without exposing credentials', async () => {
    const me = await request(app.getHttpServer()).get('/api/user')
      .set('Authorization', `Token ${aliceToken}`).expect(200);
    assert.equal(me.body.user.username, alice.username);
    assert.equal(me.headers['cache-control'], 'no-store');
    const expired = await app.get(JwtService).signAsync({sub: 1}, {expiresIn: -1});
    await request(app.getHttpServer()).get('/api/user').set('Authorization', `Token ${expired}`).expect(401);
    const updated = await request(app.getHttpServer()).put('/api/user')
      .set('Authorization', `Bearer ${aliceToken}`).send({user: {bio: 'NestJS trainee', image: null}}).expect(200);
    assert.equal(updated.body.user.bio, 'NestJS trainee');
    assert.equal(updated.body.user.image, null);
    aliceToken = updated.body.user.token;
    await request(app.getHttpServer()).put('/api/user').set('Authorization', `Token ${aliceToken}`)
      .send({user: {email: bob.email}}).expect(422);
    await request(app.getHttpServer()).put('/api/user').set('Authorization', `Token ${aliceToken}`)
      .send({user: {bio: null}}).expect(200);
  });

  it('returns public profiles and follows/unfollows idempotently', async () => {
    const profile = await request(app.getHttpServer()).get(`/api/profiles/${bob.username}`).expect(200);
    assert.equal(profile.body.profile.following, false);
    assert.equal(profile.body.profile.email, undefined);
    for (let index = 0; index < 2; index++) {
      const followed = await request(app.getHttpServer()).post(`/api/profiles/${bob.username}/follow`)
        .set('Authorization', `Token ${aliceToken}`).expect(200);
      assert.equal(followed.body.profile.following, true);
    }
    await request(app.getHttpServer()).post(`/api/profiles/${alice.username}/follow`)
      .set('Authorization', `Token ${aliceToken}`).expect(422);
    const unfollow = await request(app.getHttpServer()).delete(`/api/profiles/${bob.username}/follow`)
      .set('Authorization', `Token ${aliceToken}`).expect(200);
    assert.equal(unfollow.body.profile.following, false);
    await request(app.getHttpServer()).delete(`/api/profiles/${bob.username}/follow`)
      .set('Authorization', `Token ${aliceToken}`).expect(200);
    await request(app.getHttpServer()).get('/api/profiles/does-not-exist').expect(404);
  });

  it('creates articles with unique slugs and deduplicated tags', async () => {
    await request(app.getHttpServer()).post('/api/articles')
      .send({article: {title: 'No token', description: 'd', body: 'b'}}).expect(401);
    await request(app.getHttpServer()).post('/api/articles').set('Authorization', `Token ${bobToken}`)
      .send({article: {title: ''}}).expect(422);
    await request(app.getHttpServer()).post('/api/articles').set('Authorization', `Token ${bobToken}`)
      .send({article: []}).expect(422);
    const article = {title: `Học NestJS ${suffix}`, description: 'Tutorial article', body: 'Article content', tagList: ['nestjs', 'typescript', 'nestjs']};
    const created = await request(app.getHttpServer()).post('/api/articles')
      .set('Authorization', `Token ${bobToken}`).send({article}).expect(201);
    slug = created.body.article.slug;
    assert.equal(created.body.article.body, article.body);
    assert.deepEqual(created.body.article.tagList, ['nestjs', 'typescript']);
    assert.equal(created.body.article.favoritesCount, 0);
    assert.equal(created.body.article.author.username, bob.username);
    const duplicate = await request(app.getHttpServer()).post('/api/articles')
      .set('Authorization', `Token ${bobToken}`).send({article}).expect(201);
    assert.notEqual(duplicate.body.article.slug, slug);
    await request(app.getHttpServer()).delete(`/api/articles/${duplicate.body.article.slug}`)
      .set('Authorization', `Token ${bobToken}`).expect(204);
  });

  it('lists articles with accurate counts, filters and pagination', async () => {
    const listed = await request(app.getHttpServer()).get(`/api/articles?author=${bob.username}&limit=1`).expect(200);
    assert.equal(listed.body.articlesCount, 1);
    assert.equal(listed.body.articles.length, 1);
    assert.equal(listed.body.articles[0].body, undefined);
    const offset = await request(app.getHttpServer()).get(`/api/articles?author=${bob.username}&offset=1`).expect(200);
    assert.equal(offset.body.articlesCount, 1);
    assert.equal(offset.body.articles.length, 0);
    const tags = await request(app.getHttpServer()).get(`/api/articles?author=${bob.username}&tag=nestjs`).expect(200);
    assert.equal(tags.body.articlesCount, 1);
    const missing = await request(app.getHttpServer()).get(`/api/articles?author=${bob.username}&tag=missing`).expect(200);
    assert.equal(missing.body.articlesCount, 0);
    await request(app.getHttpServer()).get('/api/articles?limit=-1').expect(422);
    await request(app.getHttpServer()).get('/api/articles?offset=bad').expect(422);
    await request(app.getHttpServer()).get('/api/articles?limit=101').expect(422);
  });

  it('exposes full article detail and rejects edits from another user', async () => {
    const detail = await request(app.getHttpServer()).get(`/api/articles/${slug}`).expect(200);
    assert.equal(detail.body.article.body, 'Article content');
    await request(app.getHttpServer()).put(`/api/articles/${slug}`)
      .set('Authorization', `Token ${bobToken}`).send({article: [{}]}).expect(422);
    await request(app.getHttpServer()).put(`/api/articles/${slug}`)
      .set('Authorization', `Token ${aliceToken}`).send({article: {title: 'Stolen'}}).expect(403);
    await request(app.getHttpServer()).delete(`/api/articles/${slug}`)
      .set('Authorization', `Token ${aliceToken}`).expect(403);
    await request(app.getHttpServer()).get('/api/articles/missing').expect(404);
  });

  it('favorites idempotently, counts favorites and supports favorited filters', async () => {
    for (let index = 0; index < 2; index++) {
      const favorite = await request(app.getHttpServer()).post(`/api/articles/${slug}/favorite`)
        .set('Authorization', `Token ${aliceToken}`).expect(200);
      assert.equal(favorite.body.article.favoritesCount, 1);
      assert.equal(favorite.body.article.favorited, true);
    }
    const filtered = await request(app.getHttpServer()).get(`/api/articles?favorited=${alice.username}`).expect(200);
    assert.equal(filtered.body.articlesCount, 1);
    const detail = await request(app.getHttpServer()).get(`/api/articles/${slug}`).expect(200);
    assert.equal(detail.body.article.favorited, false);
    assert.equal(detail.body.article.favoritesCount, 1);
    for (let index = 0; index < 2; index++) {
      const unfavorited = await request(app.getHttpServer()).delete(`/api/articles/${slug}/favorite`)
        .set('Authorization', `Token ${aliceToken}`).expect(200);
      assert.equal(unfavorited.body.article.favoritesCount, 0);
      assert.equal(unfavorited.body.article.favorited, false);
    }
  });

  it('feeds only followed authors and includes viewer context', async () => {
    await request(app.getHttpServer()).get('/api/articles/feed').expect(401);
    const empty = await request(app.getHttpServer()).get('/api/articles/feed')
      .set('Authorization', `Token ${aliceToken}`).expect(200);
    assert.equal(empty.body.articlesCount, 0);
    await request(app.getHttpServer()).post(`/api/profiles/${bob.username}/follow`)
      .set('Authorization', `Token ${aliceToken}`).expect(200);
    const feed = await request(app.getHttpServer()).get('/api/articles/feed?limit=1')
      .set('Authorization', `Token ${aliceToken}`).expect(200);
    assert.equal(feed.body.articlesCount, 1);
    assert.equal(feed.body.articles[0].slug, slug);
    assert.equal(feed.body.articles[0].body, undefined);
    assert.equal(feed.body.articles[0].author.following, true);
  });

  it('changes the slug when updating the title and preserves other fields', async () => {
    const previous = slug;
    const updated = await request(app.getHttpServer()).put(`/api/articles/${slug}`)
      .set('Authorization', `Token ${bobToken}`).send({article: {title: `Updated ${suffix}`}}).expect(200);
    slug = updated.body.article.slug;
    assert.notEqual(slug, previous);
    assert.equal(updated.body.article.body, 'Article content');
    await request(app.getHttpServer()).get(`/api/articles/${previous}`).expect(404);
  });

  it('creates and lists comments with public profiles and enforces ownership', async () => {
    await request(app.getHttpServer()).post(`/api/articles/${slug}/comments`)
      .set('Authorization', `Token ${aliceToken}`).send({comment: {body: ''}}).expect(422);
    const created = await request(app.getHttpServer()).post(`/api/articles/${slug}/comments`)
      .set('Authorization', `Token ${aliceToken}`).send({comment: {body: 'Helpful tutorial'}}).expect(201);
    commentId = created.body.comment.id;
    assert.equal(created.body.comment.author.username, alice.username);
    const comments = await request(app.getHttpServer()).get(`/api/articles/${slug}/comments`).expect(200);
    assert.equal(comments.body.comments.length, 1);
    assert.equal(comments.body.comments[0].body, 'Helpful tutorial');
    await request(app.getHttpServer()).delete(`/api/articles/${slug}/comments/${commentId}`)
      .set('Authorization', `Token ${bobToken}`).expect(403);
    await request(app.getHttpServer()).get('/api/articles/missing/comments').expect(404);
  });

  it('returns distinct tags and deletes owned comments and articles', async () => {
    const tags = await request(app.getHttpServer()).get('/api/tags').expect(200);
    assert.ok(tags.body.tags.includes('nestjs'));
    assert.equal(new Set(tags.body.tags).size, tags.body.tags.length);
    await request(app.getHttpServer()).delete(`/api/articles/missing/comments/${commentId}`)
      .set('Authorization', `Token ${aliceToken}`).expect(404);
    await request(app.getHttpServer()).delete(`/api/articles/${slug}/comments/${commentId}`)
      .set('Authorization', `Token ${aliceToken}`).expect(204);
    await request(app.getHttpServer()).delete(`/api/articles/${slug}`)
      .set('Authorization', `Token ${bobToken}`).expect(204);
    await request(app.getHttpServer()).get(`/api/articles/${slug}`).expect(404);
    const rows = await database.query('SELECT id FROM comments WHERE id = $1', [commentId]);
    assert.equal(rows.length, 0);
  });

  it('updates passwords, rejects old credentials and rate limits login attempts', async () => {
    await request(app.getHttpServer()).put('/api/user').set('Authorization', `Token ${bobToken}`)
      .send({user: {password: 'new-training-password'}}).expect(200);
    await request(app.getHttpServer()).post('/api/users/login')
      .send({user: {email: bob.email, password: bob.password}}).expect(401);
    await request(app.getHttpServer()).post('/api/users/login')
      .send({user: {email: bob.email, password: 'new-training-password'}}).expect(200);
    let finalStatus = 0;
    for (let index = 0; index < 11; index++) {
      const attempt = await request(app.getHttpServer()).post('/api/users/login')
        .send({user: {email: 'missing@example.com', password: 'wrong-password'}});
      finalStatus = attempt.status;
    }
    assert.equal(finalStatus, 429);
  });
});
