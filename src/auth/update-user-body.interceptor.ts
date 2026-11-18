import {
  CallHandler,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  UnprocessableEntityException,
  ValidationPipe,
} from '@nestjs/common';
import type {Request} from 'express';
import {VALIDATION_OPTIONS} from '../common/validation-options';

const extractUpdateUserBody = createParamDecorator(
  (_data: unknown, context: ExecutionContext): unknown =>
    context.switchToHttp().getRequest<Request>().body,
);

export function UpdateUserBody(): ParameterDecorator {
  return extractUpdateUserBody(
    new ValidationPipe({...VALIDATION_OPTIONS, validateCustomDecorators: true}),
  );
}

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
