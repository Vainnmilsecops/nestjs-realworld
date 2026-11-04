import {Controller, Get} from '@nestjs/common';
import {ApiTags} from '@nestjs/swagger';
import {ArticlesService} from './articles.service';

@ApiTags('tags')
@Controller('tags')
export class TagsController {
  constructor(private readonly articles: ArticlesService) {}

  @Get()
  getTags() {
    return this.articles.tags();
  }
}
