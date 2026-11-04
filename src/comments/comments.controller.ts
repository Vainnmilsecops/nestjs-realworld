import {Body, Controller, Param, Post, UseGuards} from '@nestjs/common';
import {AuthGuard, CurrentUser} from '../common/auth';
import {User} from '../database/entities';
import {CommentsService, CommentView} from './comments.service';
import {CreateCommentRequestDto} from './create-comment.dto';

@Controller('articles/:slug/comments')
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Post()
  @UseGuards(AuthGuard)
  create(
    @Param('slug') slug: string,
    @Body() request: CreateCommentRequestDto,
    @CurrentUser() user: User,
  ): Promise<{comment: CommentView}> {
    return this.comments.create(slug, request.comment, user);
  }
}
