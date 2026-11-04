import {MigrationInterface, QueryRunner} from 'typeorm';

export class InitialSchema1700000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        email VARCHAR(254) NOT NULL UNIQUE,
        password_hash VARCHAR NOT NULL,
        bio TEXT,
        image TEXT
      );
      CREATE TABLE articles (
        id SERIAL PRIMARY KEY,
        slug VARCHAR(300) NOT NULL UNIQUE,
        title VARCHAR(200) NOT NULL,
        description TEXT NOT NULL,
        body TEXT NOT NULL,
        tag_list TEXT[] NOT NULL DEFAULT '{}',
        author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX articles_created_at_id_idx ON articles(created_at, id);
      CREATE INDEX articles_author_id_idx ON articles(author_id);
      CREATE INDEX articles_tag_list_idx ON articles USING GIN(tag_list);
      CREATE TABLE comments (
        id SERIAL PRIMARY KEY,
        body TEXT NOT NULL,
        article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
        author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX comments_article_id_idx ON comments(article_id);
      CREATE TABLE follows (
        follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        following_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        PRIMARY KEY (follower_id, following_id),
        CHECK (follower_id <> following_id)
      );
      CREATE TABLE favorites (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, article_id)
      );
      CREATE INDEX favorites_article_id_idx ON favorites(article_id);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE favorites, follows, comments, articles, users');
  }
}
