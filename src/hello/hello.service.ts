import {Injectable} from '@nestjs/common';
import {I18nService} from 'nestjs-i18n';
import type {Language} from '../i18n/languages';
import {HelloResponseDto} from './hello.dto';

@Injectable()
export class HelloService {
  constructor(private readonly translations: I18nService) {}

  greet(name: string | undefined, language: Language): HelloResponseDto {
    const recipient =
      name ?? this.translations.t('hello.DEFAULT_NAME', {lang: language});
    return {
      message: this.translations.t('hello.GREETING', {
        lang: language,
        args: {name: recipient},
      }),
      language,
    };
  }
}
