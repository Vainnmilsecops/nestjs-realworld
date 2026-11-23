import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {EntityManager, Repository} from 'typeorm';
import {Article} from '../articles/article.entity';
import {User} from '../users/entities/user.entity';
import {followedAuthorIds, toProfile} from '../users/profile';
import {Comment} from './comment.entity';
import {
  CommentDto,
  CommentInputDto,
  CommentListResponseDto,
  CommentResponseDto,
} from './comments.dto';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment) private readonly comments: Repository<Comment>,
  ) {}

  async create(
    slug: string,
    input: CommentInputDto,
    author: User,
  ): Promise<CommentResponseDto> {
    return this.comments.manager.transaction(async (manager) => {
      const article = await this.findArticle(slug, manager);
      const comments = manager.getRepository(Comment);
      const comment = await comments.save(
        comments.create({
          body: input.body,
          articleId: article.id,
          authorId: author.id,
          author,
        }),
      );
      return {comment: this.commentResponse(comment, false, author.id)};
    });
  }

  async list(slug: string, viewerId?: string): Promise<CommentListResponseDto> {
    const article = await this.findArticle(slug);
    const comments = await this.comments.find({
      where: {articleId: article.id},
      relations: {author: true},
      select: {
        id: true,
        body: true,
        createdAt: true,
        updatedAt: true,
        authorId: true,
        author: {id: true, username: true, bio: true, image: true},
      },
      order: {createdAt: 'DESC', id: 'DESC'},
    });
    const followedAuthors = await followedAuthorIds(
      this.comments.manager,
      comments.map((comment) => comment.authorId),
      viewerId,
    );
    return {
      comments: comments.map((comment) =>
        this.commentResponse(
          comment,
          followedAuthors.has(comment.authorId),
          viewerId,
        ),
      ),
    };
  }

  async remove(slug: string, id: number, authorId: string): Promise<void> {
    const article = await this.findArticle(slug);
    const comment = await this.comments.findOne({
      where: {id, articleId: article.id},
      select: {authorId: true},
    });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.authorId !== authorId) {
      throw new ForbiddenException('Only the comment author can delete it');
    }

    const deleted = await this.comments.delete({id});
    if (!deleted.affected) throw new NotFoundException('Comment not found');
  }

  private async findArticle(
    slug: string,
    manager?: EntityManager,
  ): Promise<Article> {
    const article = await (manager ?? this.comments.manager)
      .getRepository(Article)
      .findOne({
        where: {slug},
        select: {id: true},
        lock: manager ? {mode: 'pessimistic_read'} : undefined,
      });
    if (!article) throw new NotFoundException('Article not found');
    return article;
  }

  private commentResponse(
    comment: Comment,
    following: boolean,
    viewerId?: string,
  ): CommentDto {
    return {
      id: comment.id,
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
      author: toProfile(comment.author, following, viewerId),
    };
  }
}
