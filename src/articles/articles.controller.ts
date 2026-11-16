import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
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
  ArticleListResponseDto,
  ArticleQueryDto,
  ArticleResponseDto,
  CreateArticleRequestDto,
  UpdateArticleRequestDto,
} from './articles.dto';
import {ArticlesService} from './articles.service';

@ApiTags('articles')
@Controller('articles')
export class ArticlesController {
  constructor(private readonly articles: ArticlesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiSecurity('token')
  @ApiCreatedResponse({type: ArticleResponseDto})
  @ApiUnauthorizedResponse({description: 'A valid token is required'})
  @ApiUnprocessableEntityResponse({description: 'Invalid article'})
  create(
    @Body() {article}: CreateArticleRequestDto,
    @CurrentUser() user: User,
  ): Promise<ArticleResponseDto> {
    return this.articles.create(article, user);
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiSecurity('token')
  @ApiSecurity({})
  @ApiOkResponse({type: ArticleListResponseDto})
  @ApiUnprocessableEntityResponse({
    description: 'Invalid filters or pagination',
  })
  list(
    @Query() query: ArticleQueryDto,
    @CurrentUser() viewer: User | undefined,
  ): Promise<ArticleListResponseDto> {
    return this.articles.list(query, viewer?.id);
  }

  @Get(':slug')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiSecurity('token')
  @ApiSecurity({})
  @ApiOkResponse({type: ArticleResponseDto})
  @ApiNotFoundResponse({description: 'Article not found'})
  get(
    @Param('slug') slug: string,
    @CurrentUser() viewer: User | undefined,
  ): Promise<ArticleResponseDto> {
    return this.articles.get(slug, viewer?.id);
  }

  @Put(':slug')
  @UseGuards(JwtAuthGuard)
  @ApiSecurity('token')
  @ApiOkResponse({type: ArticleResponseDto})
  @ApiUnauthorizedResponse({description: 'A valid token is required'})
  @ApiForbiddenResponse({description: 'Only the author can update the article'})
  @ApiNotFoundResponse({description: 'Article not found'})
  @ApiUnprocessableEntityResponse({description: 'Invalid article'})
  update(
    @Param('slug') slug: string,
    @Body() {article}: UpdateArticleRequestDto,
    @CurrentUser() user: User,
  ): Promise<ArticleResponseDto> {
    return this.articles.update(slug, user.id, article);
  }

  @Delete(':slug')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiSecurity('token')
  @ApiNoContentResponse({description: 'Article deleted'})
  @ApiUnauthorizedResponse({description: 'A valid token is required'})
  @ApiForbiddenResponse({description: 'Only the author can delete the article'})
  @ApiNotFoundResponse({description: 'Article not found'})
  remove(
    @Param('slug') slug: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    return this.articles.remove(slug, user.id);
  }
}
