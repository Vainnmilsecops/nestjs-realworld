import {MigrationInterface, QueryRunner} from 'typeorm';

export class CreateUsers1793952000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE users (
        id UUID NOT NULL DEFAULT gen_random_uuid(),
        username VARCHAR(50) NOT NULL,
        email VARCHAR(254) NOT NULL,
        password_hash VARCHAR NOT NULL,
        bio TEXT,
        image TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users_id" PRIMARY KEY (id)
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX "UQ_users_username" ON users (username)',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX "UQ_users_email" ON users (email)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE users');
  }
}
