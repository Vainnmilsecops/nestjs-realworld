import {Module} from '@nestjs/common';
import {ConfigModule} from '@nestjs/config';
import {I18nModule, QueryResolver} from 'nestjs-i18n';
import {join} from 'node:path';
import {validateEnvironment} from './config/environment';
import {HelloModule} from './hello/hello.module';
import {PreferredLanguageResolver} from './i18n/preferred-language.resolver';
import {DatabaseModule} from './database/database.module';
import {AuthModule} from './auth/auth.module';
import {ArticlesModule} from './articles/articles.module';
import {CommentsModule} from './comments/comments.module';
import {UsersModule} from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({isGlobal: true, validate: validateEnvironment}),
    I18nModule.forRoot({
      fallbackLanguage: 'en',
      fallbacks: {'vi-*': 'vi', 'en-*': 'en'},
      loaderOptions: {path: join(__dirname, 'locales')},
      resolvers: [
        {use: QueryResolver, options: ['lang']},
        PreferredLanguageResolver,
      ],
    }),
    HelloModule,
    DatabaseModule,
    AuthModule,
    UsersModule,
    ArticlesModule,
    CommentsModule,
  ],
})
export class AppModule {}
