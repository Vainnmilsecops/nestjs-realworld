import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {randomUUID} from 'node:crypto';
import {EntityManager, In, Repository, SelectQueryBuilder} from 'typeorm';
import {Follow} from '../users/entities/follow.entity';
import {User} from '../users/entities/user.entity';
import {profileImage} from '../users/profile-image';
import {Article} from './article.entity';
import {ArticleFavorite} from './article-favorite.entity';
import {
  ArticleInputDto,
  ArticleListResponseDto,
  ArticleQueryDto,
  ArticleResponseDto,
  ArticleSummaryDto,
  PaginationQueryDto,
  UpdateArticleDto,
} from './articles.dto';

const MAX_SLUG_STEM_LENGTH = 200;

interface ArticleStats {
  followedAuthorIds: Set<string>;
  favorites: Map<string, {count: number; favorited: boolean}>;
}

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
    return this.articleResponse(article, author.id);
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
    if (query.favorited !== undefined) {
      articlesQuery
        .innerJoin(
          ArticleFavorite,
          'filteredFavorite',
          'filteredFavorite.articleId = article.id',
        )
        .innerJoin(
          User,
          'favoritingUser',
          'favoritingUser.id = filteredFavorite.userId AND favoritingUser.username = :favorited',
          {favorited: query.favorited},
        );
    }
    return this.listArticles(articlesQuery, query, viewerId);
  }

  async feed(
    query: PaginationQueryDto,
    viewerId: string,
  ): Promise<ArticleListResponseDto> {
    const articlesQuery = this.articleQuery().innerJoin(
      Follow,
      'feedFollow',
      'feedFollow.followingId = article.authorId AND feedFollow.followerId = :viewerId',
      {viewerId},
    );
    return this.listArticles(articlesQuery, query, viewerId);
  }

  private async listArticles(
    query: SelectQueryBuilder<Article>,
    pagination: PaginationQueryDto,
    viewerId?: string,
  ): Promise<ArticleListResponseDto> {
    const [articles, articlesCount] = await query
      .orderBy('article.createdAt', 'DESC')
      .addOrderBy('article.id', 'DESC')
      .limit(pagination.limit)
      .offset(pagination.offset)
      .getManyAndCount();
    const stats = await this.articleStats(articles, viewerId);
    return {
      articles: articles.map((article) =>
        this.articleSummary(article, stats, viewerId),
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
    return this.articleResponse(article, viewerId);
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
      return this.articleResponse(
        await articles.save(article),
        authorId,
        manager,
      );
    });
  }

  async remove(slug: string, authorId: string): Promise<void> {
    await this.articles.manager.transaction(async (manager) => {
      const articles = manager.getRepository(Article);
      const article = await this.lockOwnedArticle(articles, slug, authorId);
      await articles.delete({id: article.id, authorId});
    });
  }

  async favorite(slug: string, viewerId: string): Promise<ArticleResponseDto> {
    return this.articles.manager.transaction(async (manager) => {
      const article = await this.lockArticleForFavorite(
        manager,
        slug,
        viewerId,
      );
      await manager
        .getRepository(ArticleFavorite)
        .createQueryBuilder()
        .insert()
        .values({articleId: article.id, userId: viewerId})
        .orIgnore()
        .execute();
      return this.articleResponse(article, viewerId, manager);
    });
  }

  async unfavorite(
    slug: string,
    viewerId: string,
  ): Promise<ArticleResponseDto> {
    return this.articles.manager.transaction(async (manager) => {
      const article = await this.lockArticleForFavorite(
        manager,
        slug,
        viewerId,
      );
      await manager
        .getRepository(ArticleFavorite)
        .delete({articleId: article.id, userId: viewerId});
      return this.articleResponse(article, viewerId, manager);
    });
  }

  private async lockArticleForFavorite(
    manager: EntityManager,
    slug: string,
    viewerId: string,
  ): Promise<Article> {
    const article = await this.lockArticle(
      manager.getRepository(Article),
      slug,
      'pessimistic_read',
    );
    // Serialize this viewer's opposite actions even when no favorite row exists.
    await manager.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [`article-favorite:${article.id}:${viewerId}`],
    );
    return article;
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
    const article = await this.lockArticle(
      repository,
      slug,
      'pessimistic_write',
    );
    if (article.authorId !== authorId) {
      throw new ForbiddenException('Only the author can modify this article');
    }
    return article;
  }

  private async lockArticle(
    repository: Repository<Article>,
    slug: string,
    mode: 'pessimistic_read' | 'pessimistic_write',
  ): Promise<Article> {
    const article = await this.articleQuery(repository)
      .addSelect('article.body')
      .where('article.slug = :slug', {slug})
      .setLock(mode, undefined, ['article'])
      .getOne();
    if (!article) throw new NotFoundException('Article not found');
    return article;
  }

  private async articleStats(
    articles: Article[],
    viewerId?: string,
    manager = this.articles.manager,
  ): Promise<ArticleStats> {
    if (articles.length === 0) {
      return {followedAuthorIds: new Set(), favorites: new Map()};
    }
    const authorIds = [...new Set(articles.map((article) => article.authorId))];
    const [follows, favorites] = await Promise.all([
      viewerId === undefined
        ? []
        : manager.getRepository(Follow).find({
            where: {followerId: viewerId, followingId: In(authorIds)},
            select: {followingId: true},
          }),
      manager
        .getRepository(ArticleFavorite)
        .createQueryBuilder('favorite')
        .select('favorite.articleId', 'articleId')
        .addSelect('COUNT(*)', 'favoritesCount')
        .addSelect('BOOL_OR(favorite.userId = :viewerId)', 'favorited')
        .where('favorite.articleId IN (:...articleIds)', {
          articleIds: articles.map((article) => article.id),
        })
        .setParameter('viewerId', viewerId ?? null)
        .groupBy('favorite.articleId')
        .getRawMany<{
          articleId: string;
          favoritesCount: string;
          favorited: boolean | null;
        }>(),
    ]);
    const followedAuthorIds = new Set(
      follows.map((follow) => follow.followingId),
    );
    return {
      followedAuthorIds,
      favorites: new Map(
        favorites.map((favorite) => [
          favorite.articleId,
          {
            count: Number(favorite.favoritesCount),
            favorited: favorite.favorited ?? false,
          },
        ]),
      ),
    };
  }

  private articleSummary(
    article: Article,
    stats: ArticleStats,
    viewerId?: string,
  ): ArticleSummaryDto {
    const favorite = stats.favorites.get(article.id);
    return {
      slug: article.slug,
      title: article.title,
      description: article.description,
      tagList: article.tagList,
      createdAt: article.createdAt.toISOString(),
      updatedAt: article.updatedAt.toISOString(),
      favorited: favorite?.favorited ?? false,
      favoritesCount: favorite?.count ?? 0,
      author: {
        username: article.author.username,
        bio: article.author.bio,
        image: profileImage(article.author, viewerId),
        following: stats.followedAuthorIds.has(article.authorId),
      },
    };
  }

  private async articleResponse(
    article: Article,
    viewerId?: string,
    manager?: EntityManager,
  ): Promise<ArticleResponseDto> {
    const stats = await this.articleStats([article], viewerId, manager);
    return {
      article: {
        ...this.articleSummary(article, stats, viewerId),
        body: article.body,
      },
    };
  }
}
