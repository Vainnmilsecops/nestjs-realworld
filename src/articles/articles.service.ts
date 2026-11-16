import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {randomUUID} from 'node:crypto';
import {In, Repository} from 'typeorm';
import {Follow} from '../users/entities/follow.entity';
import {User} from '../users/entities/user.entity';
import {Article} from './article.entity';
import {
  ArticleInputDto,
  ArticleListResponseDto,
  ArticleQueryDto,
  ArticleResponseDto,
  ArticleSummaryDto,
  UpdateArticleDto,
} from './articles.dto';

const MAX_SLUG_STEM_LENGTH = 200;

function articleSlug(title: string): string {
  const normalized = title
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, '-')
    .replace(/^-|-$/g, '');
  const stem = Array.from(normalized)
    .slice(0, MAX_SLUG_STEM_LENGTH)
    .join('')
    .replace(/-$/, '');
  return `${stem || 'article'}-${randomUUID()}`;
}

@Injectable()
export class ArticlesService {
  constructor(
    @InjectRepository(Article) private readonly articles: Repository<Article>,
    @InjectRepository(Follow) private readonly follows: Repository<Follow>,
  ) {}

  async create(
    input: ArticleInputDto,
    author: User,
  ): Promise<ArticleResponseDto> {
    const article = await this.articles.save(
      this.articles.create({
        title: input.title,
        slug: articleSlug(input.title),
        description: input.description,
        body: input.body,
        tagList: [...new Set(input.tagList ?? [])],
        authorId: author.id,
        author,
      }),
    );
    return this.articleResponse(article, false);
  }

  async list(
    query: ArticleQueryDto,
    viewerId?: string,
  ): Promise<ArticleListResponseDto> {
    const articlesQuery = this.articleQuery();
    if (query.tag !== undefined) {
      articlesQuery.andWhere('article.tagList @> CAST(:tagList AS text[])', {
        tagList: [query.tag],
      });
    }
    if (query.author !== undefined) {
      articlesQuery.andWhere('author.username = :username', {
        username: query.author,
      });
    }
    const [articles, articlesCount] = await articlesQuery
      .orderBy('article.createdAt', 'DESC')
      .addOrderBy('article.id', 'DESC')
      .limit(query.limit)
      .offset(query.offset)
      .getManyAndCount();
    const following = await this.followedAuthors(articles, viewerId);
    return {
      articles: articles.map((article) =>
        this.articleSummary(article, following.has(article.authorId)),
      ),
      articlesCount,
    };
  }

  async get(slug: string, viewerId?: string): Promise<ArticleResponseDto> {
    const article = await this.articleQuery()
      .addSelect('article.body')
      .where('article.slug = :slug', {slug})
      .getOne();
    if (!article) throw new NotFoundException('Article not found');
    const following = await this.followedAuthors([article], viewerId);
    return this.articleResponse(article, following.has(article.authorId));
  }

  async update(
    slug: string,
    authorId: string,
    input: UpdateArticleDto,
  ): Promise<ArticleResponseDto> {
    return this.articles.manager.transaction(async (manager) => {
      const articles = manager.getRepository(Article);
      const article = await this.lockOwnedArticle(articles, slug, authorId);
      if (input.title !== undefined && input.title !== article.title) {
        article.title = input.title;
        article.slug = articleSlug(input.title);
      }
      if (input.description !== undefined)
        article.description = input.description;
      if (input.body !== undefined) article.body = input.body;
      return this.articleResponse(await articles.save(article), false);
    });
  }

  async remove(slug: string, authorId: string): Promise<void> {
    await this.articles.manager.transaction(async (manager) => {
      const articles = manager.getRepository(Article);
      const article = await this.lockOwnedArticle(articles, slug, authorId);
      await articles.delete({id: article.id, authorId});
    });
  }

  private articleQuery(repository = this.articles) {
    return repository
      .createQueryBuilder('article')
      .innerJoin('article.author', 'author')
      .select([
        'article.id',
        'article.slug',
        'article.title',
        'article.description',
        'article.tagList',
        'article.createdAt',
        'article.updatedAt',
        'article.authorId',
        'author.id',
        'author.username',
        'author.bio',
        'author.image',
      ]);
  }

  private async lockOwnedArticle(
    repository: Repository<Article>,
    slug: string,
    authorId: string,
  ): Promise<Article> {
    const article = await this.articleQuery(repository)
      .addSelect('article.body')
      .where('article.slug = :slug', {slug})
      .setLock('pessimistic_write', undefined, ['article'])
      .getOne();
    if (!article) throw new NotFoundException('Article not found');
    if (article.authorId !== authorId) {
      throw new ForbiddenException('Only the author can modify this article');
    }
    return article;
  }

  private async followedAuthors(
    articles: Article[],
    viewerId?: string,
  ): Promise<Set<string>> {
    if (viewerId === undefined || articles.length === 0) return new Set();
    const authorIds = [...new Set(articles.map((article) => article.authorId))];
    const follows = await this.follows.find({
      where: {followerId: viewerId, followingId: In(authorIds)},
      select: {followingId: true},
    });
    return new Set(follows.map((follow) => follow.followingId));
  }

  private articleSummary(
    article: Article,
    following: boolean,
  ): ArticleSummaryDto {
    return {
      slug: article.slug,
      title: article.title,
      description: article.description,
      tagList: article.tagList,
      createdAt: article.createdAt.toISOString(),
      updatedAt: article.updatedAt.toISOString(),
      favorited: false,
      favoritesCount: 0,
      author: {
        username: article.author.username,
        bio: article.author.bio,
        image: article.author.image,
        following,
      },
    };
  }

  private articleResponse(
    article: Article,
    following: boolean,
  ): ArticleResponseDto {
    return {
      article: {...this.articleSummary(article, following), body: article.body},
    };
  }
}
