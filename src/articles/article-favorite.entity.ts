import {Entity, Index, JoinColumn, ManyToOne, PrimaryColumn} from 'typeorm';
import {User} from '../users/entities/user.entity';
import {Article} from './article.entity';

@Entity('article_favorites')
@Index('IDX_article_favorites_article_id', ['articleId'])
export class ArticleFavorite {
  @PrimaryColumn({
    name: 'user_id',
    type: 'uuid',
    primaryKeyConstraintName: 'PK_article_favorites',
  })
  userId!: string;

  @PrimaryColumn({
    name: 'article_id',
    type: 'uuid',
    primaryKeyConstraintName: 'PK_article_favorites',
  })
  articleId!: string;

  @ManyToOne(() => User, {nullable: false, onDelete: 'CASCADE'})
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'FK_article_favorites_user',
  })
  user!: User;

  @ManyToOne(() => Article, {nullable: false, onDelete: 'CASCADE'})
  @JoinColumn({
    name: 'article_id',
    foreignKeyConstraintName: 'FK_article_favorites_article',
  })
  article!: Article;
}
