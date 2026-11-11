import 'reflect-metadata';
import {Logger} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {NestFactory} from '@nestjs/core';
import {AppModule} from './app.module';
import {configureApplication} from './bootstrap/configure-application';
import type {Environment} from './config/environment';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureApplication(app);
  app.enableShutdownHooks();
  const config = app.get<ConfigService<Environment>>(ConfigService);
  await app.listen(
    config.getOrThrow('APP_PORT', {infer: true}),
    config.getOrThrow('APP_HOST', {infer: true}),
  );
  Logger.log(
    `API and Swagger ready at ${await app.getUrl()}/api/docs`,
    'Bootstrap',
  );
}

void bootstrap();
