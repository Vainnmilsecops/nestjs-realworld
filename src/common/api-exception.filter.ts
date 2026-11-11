import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {Response} from 'express';
import {I18nService} from 'nestjs-i18n';
import {QueryFailedError} from 'typeorm';

const UNIQUE_VIOLATION = '23505';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  constructor(private readonly translations: I18nService) {}

  catch(error: unknown, host: ArgumentsHost): void {
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let messages: string[] = ['Internal server error'];
    if (error instanceof HttpException) {
      status = error.getStatus();
      const body = error.getResponse();
      const message =
        typeof body === 'string'
          ? body
          : (body as {message?: string | string[]}).message;
      messages = Array.isArray(message) ? message : [message ?? error.message];
    } else if (
      error instanceof QueryFailedError &&
      (error.driverError as {code?: string}).code === UNIQUE_VIOLATION
    ) {
      status = HttpStatus.UNPROCESSABLE_ENTITY;
      messages = [this.translations.t('auth.DUPLICATE_USER')];
    } else {
      // Record the error class without credentials, SQL parameters or tokens.
      this.logger.error({
        event: 'unhandled_api_error',
        type: error instanceof Error ? error.name : 'unknown',
      });
    }
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({errors: {body: messages}});
  }
}
