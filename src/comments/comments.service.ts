import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository} from 'typeorm';
import {ProfilePresenter, ProfileView} from '../common/profile.presenter';
import {Article, Comment, User} from '../database/entities';
import {CreateCommentDto} from './create-comment.dto';

export interface CommentView {
  id: number;
  createdAt: Date;
  updatedAt: Date;
  body: string;
  author: ProfileView;
}

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private readonly comments: Repository<Comment>,
    @InjectRepository(Article)
    private readonly articles: Repository<Article>,
    private readonly profiles: ProfilePresenter,
  ) {}

  async create(
    slug: string,
    input: CreateCommentDto,
    user: User,
  ): Promise<{comment: CommentView}> {
    const article = await this.findArticle(slug);
    const comment = await this.comments.save(
      this.comments.create({
        body: input.body,
        articleId: article.id,
        authorId: user.id,
      }),
    );
    comment.author = user;
    return {comment: await this.present(comment, user.id)};
  }

  async list(
    slug: string,
    viewerId?: number,
  ): Promise<{comments: CommentView[]}> {
    const article = await this.findArticle(slug);
    const comments = await this.comments.find({
      where: {articleId: article.id},
      relations: {author: true},
      order: {createdAt: 'ASC', id: 'ASC'},
    });
    return {
      comments: await Promise.all(
        comments.map((comment) => this.present(comment, viewerId)),
      ),
    };
  }

  async remove(slug: string, id: number, userId: number): Promise<void> {
    const article = await this.findArticle(slug);
    const comment = await this.comments.findOneBy({id, articleId: article.id});
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.authorId !== userId) {
      throw new ForbiddenException('Only the comment author can delete it');
    }
    await this.comments.delete({id, articleId: article.id, authorId: userId});
  }

  private async findArticle(slug: string): Promise<Article> {
    const article = await this.articles.findOneBy({slug});
    if (!article) throw new NotFoundException('Article not found');
    return article;
  }

  private async present(
    comment: Comment,
    viewerId?: number,
  ): Promise<CommentView> {
    return {
      id: comment.id,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      body: comment.body,
      author: await this.profiles.present(comment.author, viewerId),
    };
  }
}
