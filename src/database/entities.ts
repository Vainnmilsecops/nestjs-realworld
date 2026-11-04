import {
  Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne,
  PrimaryColumn, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn() id!: number;
  @Column({unique: true, length: 50}) username!: string;
  @Column({unique: true, length: 254}) email!: string;
  @Column({name: 'password_hash', select: false}) passwordHash!: string;
  @Column({type: 'text', nullable: true}) bio!: string | null;
  @Column({type: 'text', nullable: true}) image!: string | null;
}

@Entity('articles')
@Index(['createdAt', 'id'])
export class Article {
  @PrimaryGeneratedColumn() id!: number;
  @Column({unique: true, length: 300}) slug!: string;
  @Column({length: 200}) title!: string;
  @Column({type: 'text'}) description!: string;
  @Column({type: 'text'}) body!: string;
  @Column({name: 'tag_list', type: 'text', array: true, default: () => "'{}'"})
  tagList!: string[];
  @Index() @Column({name: 'author_id'}) authorId!: number;
  @ManyToOne(() => User, {onDelete: 'CASCADE'})
  @JoinColumn({name: 'author_id'}) author!: User;
  @CreateDateColumn({name: 'created_at', type: 'timestamptz'}) createdAt!: Date;
  @UpdateDateColumn({name: 'updated_at', type: 'timestamptz'}) updatedAt!: Date;
}

@Entity('comments')
export class Comment {
  @PrimaryGeneratedColumn() id!: number;
  @Column({type: 'text'}) body!: string;
  @Index() @Column({name: 'article_id'}) articleId!: number;
  @ManyToOne(() => Article, {onDelete: 'CASCADE'})
  @JoinColumn({name: 'article_id'}) article!: Article;
  @Column({name: 'author_id'}) authorId!: number;
  @ManyToOne(() => User, {onDelete: 'CASCADE'})
  @JoinColumn({name: 'author_id'}) author!: User;
  @CreateDateColumn({name: 'created_at', type: 'timestamptz'}) createdAt!: Date;
  @UpdateDateColumn({name: 'updated_at', type: 'timestamptz'}) updatedAt!: Date;
}

@Entity('follows')
export class Follow {
  @PrimaryColumn({name: 'follower_id'}) followerId!: number;
  @PrimaryColumn({name: 'following_id'}) followingId!: number;
  @ManyToOne(() => User, {onDelete: 'CASCADE'})
  @JoinColumn({name: 'follower_id'}) follower!: User;
  @ManyToOne(() => User, {onDelete: 'CASCADE'})
  @JoinColumn({name: 'following_id'}) following!: User;
}

@Entity('favorites')
export class Favorite {
  @PrimaryColumn({name: 'user_id'}) userId!: number;
  @PrimaryColumn({name: 'article_id'}) articleId!: number;
  @ManyToOne(() => User, {onDelete: 'CASCADE'})
  @JoinColumn({name: 'user_id'}) user!: User;
  @ManyToOne(() => Article, {onDelete: 'CASCADE'})
  @JoinColumn({name: 'article_id'}) article!: Article;
}

export const entities = [User, Article, Comment, Follow, Favorite];
