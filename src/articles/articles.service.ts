import {ForbiddenException, Injectable, NotFoundException} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {randomUUID} from 'node:crypto';
import {Repository} from 'typeorm';
import {Article, Favorite, User} from '../database/entities';
import {ArticlesPresenter} from './articles.presenter';
import {CreateArticleDto} from './dto/create-article.dto';
import {UpdateArticleDto} from './dto/update-article.dto';
import {ListArticlesDto} from './dto/list-articles.dto';

@Injectable()
export class ArticlesService {
  constructor(
    @InjectRepository(Article) private readonly articles: Repository<Article>,
    private readonly presenter: ArticlesPresenter,
  ) {}

  async create(input: CreateArticleDto, author: User) {
    const article = await this.articles.save(this.articles.create({
      ...input, slug: this.slugFor(input.title), tagList: input.tagList ?? [],
      authorId: author.id, author,
    }));
    return {article: await this.presenter.present(article, author.id)};
  }

  async get(slug: string, viewerId?: number) {
    return {article: await this.presenter.present(await this.findBySlug(slug), viewerId)};
  }

  async update(slug: string, input: UpdateArticleDto, userId: number) {
    const article = await this.findBySlug(slug);
    this.assertAuthor(article, userId);
    if (input.title !== undefined && input.title !== article.title) {
      article.slug = this.slugFor(input.title);
    }
    Object.assign(article, input);
    await this.articles.save(article);
    return {article: await this.presenter.present(article, userId)};
  }

  async delete(slug: string, userId: number): Promise<void> {
    const article = await this.findBySlug(slug);
    this.assertAuthor(article, userId);
    await this.articles.delete(article.id);
  }

  async list(input: ListArticlesDto, viewerId?: number) {
    const query = this.articles.createQueryBuilder('article')
      .innerJoinAndSelect('article.author', 'author');
    if (input.tag !== undefined) {
      query.andWhere('article.tagList @> ARRAY[:tag]::text[]', {tag: input.tag});
    }
    if (input.author !== undefined) {
      query.andWhere('author.username = :author', {author: input.author});
    }
    if (input.favorited !== undefined) {
      query.andWhere(qb => {
        const subquery = qb.subQuery().select('1').from(Favorite, 'favorite')
          .innerJoin(User, 'fan', 'fan.id = favorite.userId')
          .where('favorite.articleId = article.id')
          .andWhere('fan.username = :favorited').getQuery();
        return `EXISTS ${subquery}`;
      }, {favorited: input.favorited});
    }
    const [articles, articlesCount] = await query
      .orderBy('article.createdAt', 'DESC').addOrderBy('article.id', 'DESC')
      .take(input.limit).skip(input.offset).getManyAndCount();
    return {articles: await this.presenter.presentList(articles, viewerId), articlesCount};
  }

  private assertAuthor(article: Article, userId: number): void {
    if (article.authorId !== userId) throw new ForbiddenException('Only the author can modify this article');
  }

  private async findBySlug(slug: string): Promise<Article> {
    const article = await this.articles.findOne({where: {slug}, relations: {author: true}});
    if (!article) throw new NotFoundException('Article not found');
    return article;
  }

  private slugFor(title: string): string {
    const prefix = title.trim().toLowerCase().normalize('NFKC')
      .replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'article';
    return `${prefix}-${randomUUID()}`;
  }
}
