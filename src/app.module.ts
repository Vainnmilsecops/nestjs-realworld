import {Module} from '@nestjs/common';
import {CoreModule} from './common/core.module';
import {UsersModule} from './users/users.module';
import {ArticlesModule} from './articles/articles.module';
import {CommentsModule} from './comments/comments.module';

@Module({imports: [CoreModule, UsersModule, ArticlesModule, CommentsModule]})
export class AppModule {}
