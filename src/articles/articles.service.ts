import {Injectable, NotFoundException} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {randomUUID} from 'node:crypto';
import {Repository} from 'typeorm';
import {Article, User} from '../database/entities';
import {ArticlesPresenter} from './articles.presenter';
import {CreateArticleDto} from './dto/create-article.dto';

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
