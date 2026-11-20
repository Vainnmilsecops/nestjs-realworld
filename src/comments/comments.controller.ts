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
import {
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import {CurrentUser} from '../auth/current-user.decorator';
import {JwtAuthGuard} from '../auth/jwt-auth.guard';
import {OptionalJwtAuthGuard} from '../auth/optional-jwt-auth.guard';
import type {User} from '../users/entities/user.entity';
import {
  CommentListResponseDto,
  CommentResponseDto,
  CreateCommentRequestDto,
  DeleteCommentParamsDto,
} from './comments.dto';
import {CommentsService} from './comments.service';

@ApiTags('comments')
@Controller('articles/:slug/comments')
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiSecurity('token')
  @ApiCreatedResponse({type: CommentResponseDto})
  @ApiUnauthorizedResponse({description: 'A valid token is required'})
  @ApiNotFoundResponse({description: 'Article not found'})
  @ApiUnprocessableEntityResponse({description: 'Invalid comment'})
  create(
    @Param('slug') slug: string,
    @Body() {comment}: CreateCommentRequestDto,
    @CurrentUser() author: User,
  ): Promise<CommentResponseDto> {
    return this.comments.create(slug, comment, author);
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiSecurity('token')
  @ApiSecurity({})
  @ApiOkResponse({type: CommentListResponseDto})
  @ApiNotFoundResponse({description: 'Article not found'})
  @ApiUnauthorizedResponse({
    description: 'The supplied token is invalid or revoked',
  })
  list(
    @Param('slug') slug: string,
    @CurrentUser() viewer: User | undefined,
  ): Promise<CommentListResponseDto> {
    return this.comments.list(slug, viewer?.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiSecurity('token')
  @ApiNoContentResponse({description: 'Comment deleted'})
  @ApiUnauthorizedResponse({description: 'A valid token is required'})
  @ApiForbiddenResponse({description: 'Only the comment author can delete it'})
  @ApiNotFoundResponse({description: 'Article or comment not found'})
  @ApiUnprocessableEntityResponse({description: 'Invalid comment ID'})
  remove(
    @Param() {slug, id}: DeleteCommentParamsDto,
    @CurrentUser() author: User,
  ): Promise<void> {
    return this.comments.remove(slug, id, author.id);
  }
}
