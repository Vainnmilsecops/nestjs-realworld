import {MigrationInterface, QueryRunner} from 'typeorm';

export class CreateArticles1794787200000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE articles (
        id UUID NOT NULL DEFAULT gen_random_uuid(),
        slug VARCHAR(255) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        body TEXT NOT NULL,
        tag_list TEXT[] NOT NULL DEFAULT '{}',
        author_id UUID NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_articles_id" PRIMARY KEY (id),
        CONSTRAINT "FK_articles_author" FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX "UQ_articles_slug" ON articles (slug)',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_articles_created_at_id" ON articles (created_at, id)',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_articles_author_created_at_id" ON articles (author_id, created_at, id)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE articles');
  }
}
