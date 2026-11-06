import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
@Index('UQ_users_username', ['username'], {unique: true})
@Index('UQ_users_email', ['email'], {unique: true})
export class User {
  @PrimaryGeneratedColumn('uuid', {primaryKeyConstraintName: 'PK_users_id'})
  id!: string;

  @Column({type: 'varchar', length: 50})
  username!: string;

  @Column({type: 'varchar', length: 254})
  email!: string;

  @Column({name: 'password_hash', type: 'varchar', select: false})
  passwordHash!: string;

  @Column({type: 'text', nullable: true})
  bio!: string | null;

  @Column({type: 'text', nullable: true})
  image!: string | null;

  @CreateDateColumn({name: 'created_at', type: 'timestamptz'})
  createdAt!: Date;

  @UpdateDateColumn({name: 'updated_at', type: 'timestamptz'})
  updatedAt!: Date;
}
