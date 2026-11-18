import type {ValidationPipeOptions} from '@nestjs/common';

export const VALIDATION_OPTIONS: ValidationPipeOptions = {
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  errorHttpStatusCode: 422,
};
