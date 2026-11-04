import {Module} from '@nestjs/common';
import {ArticlesController} from './articles.controller';
import {ArticlesPresenter} from './articles.presenter';
import {ArticlesService} from './articles.service';

@Module({
  controllers: [ArticlesController],
  providers: [ArticlesService, ArticlesPresenter],
})
export class ArticlesModule {}
