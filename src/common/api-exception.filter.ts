import {
  ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger,
} from '@nestjs/common';
import {Response} from 'express';
import {QueryFailedError} from 'typeorm';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let messages: string[] = ['Internal server error'];
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      const message = typeof body === 'string' ? body : (body as {message?: string | string[]}).message;
      messages = Array.isArray(message) ? message : [message ?? exception.message];
    } else if (exception instanceof QueryFailedError) {
      const code = (exception.driverError as {code?: string}).code;
      if (code === '23505') {
        status = HttpStatus.UNPROCESSABLE_ENTITY;
        messages = ['Email, username or slug has already been taken'];
      } else {
        this.logger.error(exception);
      }
    } else {
      this.logger.error(exception);
    }
    response.status(status).json({errors: {body: messages}});
  }
}
