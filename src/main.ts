import 'reflect-metadata';
import {Logger} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {NestFactory} from '@nestjs/core';
import {AppModule} from './app.module';
import {configureApplication} from './bootstrap/configure-application';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureApplication(app);
  app.enableShutdownHooks();
  const config = app.get(ConfigService);
  await app.listen(
    config.getOrThrow<number>('APP_PORT'),
    config.getOrThrow<string>('APP_HOST'),
  );
  Logger.log(
    `API and Swagger ready at ${await app.getUrl()}/api/docs`,
    'Bootstrap',
  );
}

void bootstrap();
