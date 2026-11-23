import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {Article} from '../articles/article.entity';
import {AuthModule} from '../auth/auth.module';
import {OptionalJwtAuthGuard} from '../auth/optional-jwt-auth.guard';
import {Follow} from '../users/entities/follow.entity';
import {Comment} from './comment.entity';
import {CommentsController} from './comments.controller';
import {CommentsService} from './comments.service';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([Comment, Article, Follow])],
  controllers: [CommentsController],
  providers: [CommentsService, OptionalJwtAuthGuard],
})
export class CommentsModule {}
