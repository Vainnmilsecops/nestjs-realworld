import {Module} from '@nestjs/common';
import {ConfigModule} from '@nestjs/config';
import {I18nModule, QueryResolver} from 'nestjs-i18n';
import {join} from 'node:path';
import {validateEnvironment} from './config/environment';
import {HelloModule} from './hello/hello.module';
import {ENGLISH} from './i18n/languages';
import {PreferredLanguageResolver} from './i18n/preferred-language.resolver';
import {DatabaseModule} from './database/database.module';
import {AuthModule} from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({isGlobal: true, validate: validateEnvironment}),
    I18nModule.forRoot({
      fallbackLanguage: ENGLISH,
      loaderOptions: {path: join(__dirname, 'locales')},
      resolvers: [
        {use: QueryResolver, options: ['lang']},
        PreferredLanguageResolver,
      ],
    }),
    HelloModule,
    DatabaseModule,
    AuthModule,
  ],
})
export class AppModule {}
