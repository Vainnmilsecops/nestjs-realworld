import 'reflect-metadata';
import {NestFactory} from '@nestjs/core';
import {AppModule} from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 3000), process.env.HOST ?? '127.0.0.1');
}

void bootstrap();
