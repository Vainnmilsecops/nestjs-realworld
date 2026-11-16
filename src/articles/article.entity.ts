import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {User} from '../users/entities/user.entity';

@Entity('articles')
@Index('UQ_articles_slug', ['slug'], {unique: true})
@Index('IDX_articles_created_at_id', ['createdAt', 'id'])
@Index('IDX_articles_author_created_at_id', ['authorId', 'createdAt', 'id'])
export class Article {
  @PrimaryGeneratedColumn('uuid', {primaryKeyConstraintName: 'PK_articles_id'})
  id!: string;

  @Column({type: 'varchar', length: 255})
  slug!: string;

  @Column({type: 'varchar', length: 255})
  title!: string;

  @Column({type: 'text'})
  description!: string;

  @Column({type: 'text'})
  body!: string;

  @Column({name: 'tag_list', type: 'text', array: true, default: () => "'{}'"})
  tagList!: string[];

  @Column({name: 'author_id', type: 'uuid'})
  authorId!: string;

  @ManyToOne(() => User, {nullable: false, onDelete: 'CASCADE'})
  @JoinColumn({
    name: 'author_id',
    foreignKeyConstraintName: 'FK_articles_author',
  })
  author!: User;

  @CreateDateColumn({name: 'created_at', type: 'timestamptz'})
  createdAt!: Date;

  @UpdateDateColumn({name: 'updated_at', type: 'timestamptz'})
  updatedAt!: Date;
}
