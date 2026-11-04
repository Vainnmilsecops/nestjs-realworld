import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {AuthGuard, CurrentUser, OptionalAuthGuard} from '../common/auth';
import {User} from '../database/entities';
import {CommentsService, CommentView} from './comments.service';
import {CreateCommentRequestDto} from './create-comment.dto';
import {DeleteCommentParamsDto} from './delete-comment-params.dto';

@Controller('articles/:slug/comments')
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get()
  @UseGuards(OptionalAuthGuard)
  list(
    @Param('slug') slug: string,
    @CurrentUser() user: User | undefined,
  ): Promise<{comments: CommentView[]}> {
    return this.comments.list(slug, user?.id);
  }

  @Post()
  @UseGuards(AuthGuard)
  create(
    @Param('slug') slug: string,
    @Body() request: CreateCommentRequestDto,
    @CurrentUser() user: User,
  ): Promise<{comment: CommentView}> {
    return this.comments.create(slug, request.comment, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard)
  remove(
    @Param() params: DeleteCommentParamsDto,
    @CurrentUser() user: User,
  ): Promise<void> {
    return this.comments.remove(params.slug, params.id, user.id);
  }
}
