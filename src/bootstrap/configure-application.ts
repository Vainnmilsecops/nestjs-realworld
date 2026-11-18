import {INestApplication, ValidationPipe} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {DocumentBuilder, SwaggerModule} from '@nestjs/swagger';
import helmet from 'helmet';
import {NextFunction, Request, Response} from 'express';
import {ApiExceptionFilter} from '../common/api-exception.filter';
import {VALIDATION_OPTIONS} from '../common/validation-options';

export function configureApplication(app: INestApplication): void {
  const config = app.get(ConfigService);
  app.setGlobalPrefix('api');
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {'script-src': ["'self'"], 'img-src': ["'self'", 'data:']},
      },
    }),
  );
  app.enableCors({origin: config.getOrThrow<string[]>('CORS_ORIGINS')});
  app.use((_request: Request, response: Response, next: NextFunction) => {
    response.set({
      'Cache-Control': 'no-store',
      Pragma: 'no-cache',
      Expires: '0',
    });
    next();
  });
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalPipes(new ValidationPipe(VALIDATION_OPTIONS));
  const options = new DocumentBuilder()
    .setTitle('RealWorld Training API')
    .setDescription(
      'RealWorld accounts, profiles, follows and private avatars.',
    )
    .setVersion('0.3.0')
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'Authorization',
        description: 'Token <jwt> or Bearer <jwt>',
      },
      'token',
    )
    .build();
  SwaggerModule.setup(
    'api/docs',
    app,
    SwaggerModule.createDocument(app, options),
  );
}
