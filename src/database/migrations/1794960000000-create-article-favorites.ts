import {MigrationInterface, QueryRunner} from 'typeorm';

export class CreateArticleFavorites1794960000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE article_favorites (
        user_id UUID NOT NULL,
        article_id UUID NOT NULL,
        CONSTRAINT "PK_article_favorites" PRIMARY KEY (user_id, article_id),
        CONSTRAINT "FK_article_favorites_user" FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        CONSTRAINT "FK_article_favorites_article" FOREIGN KEY (article_id) REFERENCES articles (id) ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_article_favorites_article_id" ON article_favorites (article_id)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE article_favorites');
  }
}
