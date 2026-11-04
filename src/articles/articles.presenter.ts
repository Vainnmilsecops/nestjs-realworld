import {Injectable} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository} from 'typeorm';
import {ProfilePresenter, ProfileView} from '../common/profile.presenter';
import {Article, Favorite} from '../database/entities';

export interface ArticleSummary {
  slug: string;
  title: string;
  description: string;
  tagList: string[];
  createdAt: string;
  updatedAt: string;
  favorited: boolean;
  favoritesCount: number;
  author: ProfileView;
}

export interface ArticleView extends ArticleSummary {body: string;}

@Injectable()
export class ArticlesPresenter {
  constructor(
    @InjectRepository(Favorite) private readonly favorites: Repository<Favorite>,
    private readonly profiles: ProfilePresenter,
  ) {}

  async present(article: Article, viewerId?: number): Promise<ArticleView> {
    const [favoritesCount, favorited, author] = await Promise.all([
      this.favorites.countBy({articleId: article.id}),
      viewerId === undefined ? false : this.favorites.existsBy({articleId: article.id, userId: viewerId}),
      this.profiles.present(article.author, viewerId),
    ]);
    return {
      slug: article.slug, title: article.title, description: article.description,
      body: article.body, tagList: article.tagList,
      createdAt: article.createdAt.toISOString(), updatedAt: article.updatedAt.toISOString(),
      favorited, favoritesCount, author,
    };
  }

  async presentList(articles: Article[], viewerId?: number): Promise<ArticleSummary[]> {
    if (articles.length === 0) return [];
    const counts = await this.favorites.createQueryBuilder('favorite')
      .select('favorite.articleId', 'articleId')
      .addSelect('COUNT(*)', 'count')
      .addSelect('MAX(CASE WHEN favorite.userId = :viewerId THEN 1 ELSE 0 END)', 'favorited')
      .where('favorite.articleId IN (:...ids)', {ids: articles.map(article => article.id)})
      .setParameter('viewerId', viewerId ?? -1)
      .groupBy('favorite.articleId')
      .getRawMany<{articleId: number; count: string; favorited: number}>();
    const byId = new Map(counts.map(count => [count.articleId, count]));
    return Promise.all(articles.map(async article => {
      const count = byId.get(article.id);
      return {
        slug: article.slug, title: article.title, description: article.description,
        tagList: article.tagList, createdAt: article.createdAt.toISOString(),
        updatedAt: article.updatedAt.toISOString(), favorited: Number(count?.favorited ?? 0) > 0,
        favoritesCount: Number(count?.count ?? 0),
        author: await this.profiles.present(article.author, viewerId),
      };
    }));
  }
}
