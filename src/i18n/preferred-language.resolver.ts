import {ExecutionContext, Injectable} from '@nestjs/common';
import type {Request} from 'express';
import type {I18nResolver} from 'nestjs-i18n';
import {SUPPORTED_LANGUAGES, type Language} from './languages';

@Injectable()
export class PreferredLanguageResolver implements I18nResolver {
  resolve(context: ExecutionContext): Language | undefined {
    if (context.getType() !== 'http') return undefined;
    const header = context.switchToHttp().getRequest<Request>().headers[
      'accept-language'
    ];
    if (!header) return undefined;
    let preferred: Language | undefined;
    let highestQuality = 0;
    for (const entry of header.split(',')) {
      const match =
        /^\s*([a-z]{1,8}(?:-[a-z0-9]{1,8})*|\*)(?:\s*;\s*q\s*=\s*(0(?:\.\d{0,3})?|1(?:\.0{0,3})?))?\s*$/i.exec(
          entry,
        );
      if (!match?.[1]) continue;
      const range = match[1].split('-')[0]?.toLowerCase();
      const language = SUPPORTED_LANGUAGES.find(
        (supported) => supported === range,
      );
      if (!language && range !== '*') continue;
      const quality = Number(match[2] ?? 1);
      if (quality > highestQuality) {
        // A winning wildcard defers to the configured fallback language.
        preferred = language;
        highestQuality = quality;
      }
    }
    return preferred;
  }
}
