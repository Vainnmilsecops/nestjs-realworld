import {MigrationInterface, QueryRunner} from 'typeorm';

export class CreateFollows1794355200000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE follows (
        follower_id UUID NOT NULL,
        following_id UUID NOT NULL,
        CONSTRAINT "PK_follows" PRIMARY KEY (follower_id, following_id),
        CONSTRAINT "FK_follows_follower" FOREIGN KEY (follower_id) REFERENCES users (id) ON DELETE CASCADE,
        CONSTRAINT "FK_follows_following" FOREIGN KEY (following_id) REFERENCES users (id) ON DELETE CASCADE,
        CONSTRAINT "CHK_follows_no_self_follow" CHECK ("follower_id" <> "following_id")
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_follows_following_id" ON follows (following_id)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE follows');
  }
}
