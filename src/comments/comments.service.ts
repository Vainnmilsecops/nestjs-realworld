import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Any, EntityManager, Repository} from 'typeorm';
import {Article} from '../articles/article.entity';
import {Follow} from '../users/entities/follow.entity';
import {User} from '../users/entities/user.entity';
import {profileImage} from '../users/profile-image';
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
      const article = await this.findArticle(slug, manager, true);
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
    const follows =
      viewerId === undefined || comments.length === 0
        ? []
        : await this.comments.manager.getRepository(Follow).find({
            where: {
              followerId: viewerId,
              followingId: Any([
                ...new Set(comments.map((comment) => comment.authorId)),
              ]),
            },
            select: {followingId: true},
          });
    const followedAuthors = new Set(
      follows.map((follow) => follow.followingId),
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
    await this.comments.manager.transaction(async (manager) => {
      const article = await this.findArticle(slug, manager, true);
      const comments = manager.getRepository(Comment);
      const comment = await comments.findOne({
        where: {id, articleId: article.id},
        lock: {mode: 'pessimistic_write'},
      });
      if (!comment) throw new NotFoundException('Comment not found');
      if (comment.authorId !== authorId) {
        throw new ForbiddenException('Only the comment author can delete it');
      }
      await comments.delete({id, articleId: article.id, authorId});
    });
  }

  private async findArticle(
    slug: string,
    manager: EntityManager = this.comments.manager,
    lock = false,
  ): Promise<Article> {
    const article = await manager.getRepository(Article).findOne({
      where: {slug},
      select: {id: true},
      lock: lock ? {mode: 'pessimistic_read'} : undefined,
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
      author: {
        username: comment.author.username,
        bio: comment.author.bio,
        image: profileImage(comment.author, viewerId),
        following,
      },
    };
  }
}
