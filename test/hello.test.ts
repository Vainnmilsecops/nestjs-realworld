import 'reflect-metadata';
import assert from 'node:assert/strict';
import {after, before, describe, it} from 'node:test';
import {INestApplication} from '@nestjs/common';
import {Test} from '@nestjs/testing';
import request from 'supertest';
import {configureTestServices} from './support/services';

describe('Hello API', () => {
  let app: INestApplication;

  before(async () => {
    configureTestServices();
    const {AppModule} = await import('../src/app.module');
    const {configureApplication} =
      await import('../src/bootstrap/configure-application');
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApplication(app);
    await app.init();
  });

  after(async () => {
    if (app) await app.close();
  });

  it('returns the English default and trims supplied names', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/hello')
      .expect(200);
    assert.deepEqual(response.body, {message: 'Hello, World!', language: 'en'});
    const named = await request(app.getHttpServer())
      .get('/api/hello')
      .query({name: '  An  '})
      .expect(200);
    assert.deepEqual(named.body, {message: 'Hello, An!', language: 'en'});
  });

  it('returns Vietnamese translations, including the default name', async () => {
    const named = await request(app.getHttpServer())
      .get('/api/hello')
      .query({name: 'An', lang: 'vi'})
      .expect(200);
    assert.deepEqual(named.body, {message: 'Xin chào, An!', language: 'vi'});
    const unnamed = await request(app.getHttpServer())
      .get('/api/hello')
      .query({lang: 'vi'})
      .expect(200);
    assert.deepEqual(unnamed.body, {message: 'Xin chào, bạn!', language: 'vi'});
  });

  it('resolves Accept-Language and lets the query override it', async () => {
    for (const language of ['vi', 'vi-VN']) {
      const response = await request(app.getHttpServer())
        .get('/api/hello')
        .query({name: 'An'})
        .set('Accept-Language', language)
        .expect(200);
      assert.deepEqual(response.body, {
        message: 'Xin chào, An!',
        language: 'vi',
      });
    }
    const fallback = await request(app.getHttpServer())
      .get('/api/hello')
      .set('Accept-Language', 'fr')
      .expect(200);
    assert.deepEqual(fallback.body, {message: 'Hello, World!', language: 'en'});
    const weighted = await request(app.getHttpServer())
      .get('/api/hello')
      .set('Accept-Language', 'vi-VN, en;q=0.8')
      .expect(200);
    assert.equal(weighted.body.language, 'vi');
    const excluded = await request(app.getHttpServer())
      .get('/api/hello')
      .set('Accept-Language', 'vi;q=0, en;q=0')
      .expect(200);
    assert.equal(excluded.body.language, 'en');
    const override = await request(app.getHttpServer())
      .get('/api/hello')
      .query({name: 'An', lang: 'en'})
      .set('Accept-Language', 'vi-VN')
      .expect(200);
    assert.deepEqual(override.body, {message: 'Hello, An!', language: 'en'});
  });

  it('keeps simultaneous requests in their own language', async () => {
    const [english, vietnamese] = await Promise.all([
      request(app.getHttpServer())
        .get('/api/hello')
        .query({name: 'Alice'})
        .set('Accept-Language', 'en')
        .expect(200),
      request(app.getHttpServer())
        .get('/api/hello')
        .query({name: 'Lan'})
        .set('Accept-Language', 'vi-VN')
        .expect(200),
    ]);
    assert.deepEqual(english.body, {message: 'Hello, Alice!', language: 'en'});
    assert.deepEqual(vietnamese.body, {
      message: 'Xin chào, Lan!',
      language: 'vi',
    });
  });

  it('accepts the name length boundary and rejects invalid query input', async () => {
    const boundary = 'A'.repeat(80);
    const response = await request(app.getHttpServer())
      .get('/api/hello')
      .query({name: boundary})
      .expect(200);
    assert.equal(response.body.message, `Hello, ${boundary}!`);
    const invalidQueries = [
      'name=',
      'name=%20%20',
      `name=${'A'.repeat(81)}`,
      'name=An&name=Lan',
      'lang=fr',
      'lang=',
      'lang=vi&lang=en',
      'unexpected=true',
    ];
    for (const query of invalidQueries) {
      await request(app.getHttpServer()).get(`/api/hello?${query}`).expect(422);
    }
  });

  it('serves Swagger UI and documents the query and response contract', async () => {
    await request(app.getHttpServer())
      .get('/api/docs')
      .expect(200)
      .expect('Content-Type', /html/);
    const response = await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);
    const operation = response.body.paths['/api/hello'].get;
    for (const name of ['name', 'lang']) {
      assert.ok(
        operation.parameters.some(
          (parameter: {name: string; in: string}) =>
            parameter.name === name && parameter.in === 'query',
        ),
      );
    }
    const schema =
      operation.responses['200'].content['application/json'].schema;
    assert.equal(schema.$ref, '#/components/schemas/HelloResponseDto');
    const properties =
      response.body.components.schemas.HelloResponseDto.properties;
    assert.equal(properties.message.type, 'string');
    assert.deepEqual(properties.language.enum, ['en', 'vi']);
  });
});
