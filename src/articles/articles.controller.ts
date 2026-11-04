import {Body, Controller, Delete, Get, HttpCode, Param, Post, Put, UseGuards} from '@nestjs/common';
import {ApiSecurity, ApiTags} from '@nestjs/swagger';
import {AuthGuard, CurrentUser, OptionalAuthGuard} from '../common/auth';
import {User} from '../database/entities';
import {ArticlesService} from './articles.service';
import {CreateArticleRequest} from './dto/create-article.dto';
import {UpdateArticleRequest} from './dto/update-article.dto';

@ApiTags('articles')
@Controller('articles')
export class ArticlesController {
  constructor(private readonly articles: ArticlesService) {}

  @Post()
  @UseGuards(AuthGuard)
  @ApiSecurity('token')
  create(@Body() request: CreateArticleRequest, @CurrentUser() user: User) {
    return this.articles.create(request.article, user);
  }

  @Get(':slug')
  @UseGuards(OptionalAuthGuard)
  get(@Param('slug') slug: string, @CurrentUser() user?: User) {
    return this.articles.get(slug, user?.id);
  }

  @Put(':slug')
  @UseGuards(AuthGuard)
  @ApiSecurity('token')
  update(@Param('slug') slug: string, @Body() request: UpdateArticleRequest, @CurrentUser() user: User) {
    return this.articles.update(slug, request.article, user.id);
  }

  @Delete(':slug')
  @HttpCode(204)
  @UseGuards(AuthGuard)
  @ApiSecurity('token')
  delete(@Param('slug') slug: string, @CurrentUser() user: User) {
    return this.articles.delete(slug, user.id);
  }
}
