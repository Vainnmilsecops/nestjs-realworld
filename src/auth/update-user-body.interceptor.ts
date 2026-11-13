import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  UnprocessableEntityException,
} from '@nestjs/common';
import type {Request} from 'express';

@Injectable()
export class UpdateUserBodyInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context
      .switchToHttp()
      .getRequest<Request & {body: Record<string, unknown>; file?: unknown}>();
    if (request.is('multipart/form-data')) {
      const {user} = request.body;
      if (typeof user === 'string') {
        try {
          request.body.user = JSON.parse(user);
        } catch {
          throw new UnprocessableEntityException('user must be a JSON object');
        }
      } else if (user === undefined && request.file) {
        request.body.user = {};
      }
    }
    return next.handle();
  }
}
