import {Module} from '@nestjs/common';
import {CoreModule} from './common/core.module';
import {UsersModule} from './users/users.module';
import {ArticlesModule} from './articles/articles.module';

@Module({imports: [CoreModule, UsersModule, ArticlesModule]})
export class AppModule {}
