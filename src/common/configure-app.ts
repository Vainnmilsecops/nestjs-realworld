import {INestApplication, ValidationPipe} from '@nestjs/common';
import helmet from 'helmet';
import {NextFunction, Request, Response} from 'express';
import {ApiExceptionFilter} from './api-exception.filter';

export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.use(helmet());
  app.use((_request: Request, response: Response, next: NextFunction) => {
    response.set({'Cache-Control': 'no-store', Pragma: 'no-cache', Expires: '0'});
    next();
  });
  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(','),
    allowedHeaders: ['Content-Type', 'Authorization'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });
  app.useGlobalPipes(new ValidationPipe({
    transform: true, whitelist: true, forbidNonWhitelisted: true,
    errorHttpStatusCode: 422,
  }));
  app.useGlobalFilters(new ApiExceptionFilter());
}
