import {Injectable} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository} from 'typeorm';
import {ProfilePresenter, ProfileView} from '../common/profile.presenter';
import {Article, Favorite} from '../database/entities';

export interface ArticleView {
  slug: string;
  title: string;
  description: string;
  body: string;
  tagList: string[];
  createdAt: string;
  updatedAt: string;
  favorited: boolean;
  favoritesCount: number;
  author: ProfileView;
}

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
}
