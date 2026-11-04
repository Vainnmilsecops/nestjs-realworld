import {Body, Controller, Post, UseGuards} from '@nestjs/common';
import {ApiSecurity, ApiTags} from '@nestjs/swagger';
import {AuthGuard, CurrentUser} from '../common/auth';
import {User} from '../database/entities';
import {ArticlesService} from './articles.service';
import {CreateArticleRequest} from './dto/create-article.dto';

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
}
