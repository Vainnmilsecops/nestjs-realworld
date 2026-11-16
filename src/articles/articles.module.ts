import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {AuthModule} from '../auth/auth.module';
import {OptionalJwtAuthGuard} from '../auth/optional-jwt-auth.guard';
import {Follow} from '../users/entities/follow.entity';
import {Article} from './article.entity';
import {ArticlesController} from './articles.controller';
import {ArticlesService} from './articles.service';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([Article, Follow])],
  controllers: [ArticlesController],
  providers: [ArticlesService, OptionalJwtAuthGuard],
})
export class ArticlesModule {}
