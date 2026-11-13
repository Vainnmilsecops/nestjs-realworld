import {MigrationInterface, QueryRunner} from 'typeorm';

export class CreateAttachments1794528000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE attachments (
        id UUID NOT NULL,
        url VARCHAR(128) NOT NULL,
        file_name VARCHAR(64) NOT NULL,
        file_type VARCHAR(64) NOT NULL,
        file_size INTEGER NOT NULL,
        owner_type VARCHAR(32) NOT NULL,
        owner_id UUID NOT NULL,
        CONSTRAINT "PK_attachments" PRIMARY KEY (id),
        CONSTRAINT "CHK_attachments_positive_size" CHECK ("file_size" > 0)
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_attachments_user_avatar"
      ON attachments (owner_type, owner_id)
      WHERE "owner_type" = 'user'
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE attachments');
  }
}
