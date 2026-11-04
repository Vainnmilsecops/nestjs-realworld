import 'reflect-metadata';
import {NestFactory} from '@nestjs/core';
import {AppModule} from './app.module';
import {DocumentBuilder, SwaggerModule} from '@nestjs/swagger';
import {configureApp} from './common/configure-app';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  const swagger = new DocumentBuilder().setTitle('RealWorld API').setVersion('1.0')
    .addApiKey({type: 'apiKey', in: 'header', name: 'Authorization', description: 'Token <jwt>'}, 'token')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger));
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 3000), process.env.HOST ?? '127.0.0.1');
}

void bootstrap();
