import {Module} from '@nestjs/common';
import {ArticlesController} from './articles.controller';
import {ArticlesPresenter} from './articles.presenter';
import {ArticlesService} from './articles.service';
import {TagsController} from './tags.controller';

@Module({
  controllers: [ArticlesController, TagsController],
  providers: [ArticlesService, ArticlesPresenter],
})
export class ArticlesModule {}
