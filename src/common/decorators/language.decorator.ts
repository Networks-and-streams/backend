import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

import { DEFAULT_LANGUAGE, Language as LanguageType, SUPPORTED_LANGUAGES } from '@/common/types/language';

export const Lang = createParamDecorator((_data: unknown, ctx: ExecutionContext): LanguageType => {
  const request = ctx.switchToHttp().getRequest<Request>();
  const header = request.headers['accept-language'];

  if (!header) {
    return DEFAULT_LANGUAGE;
  }

  const primary = header.split(',')[0].split('-')[0].trim().toLowerCase();

  return SUPPORTED_LANGUAGES.includes(primary as LanguageType) ? (primary as LanguageType) : DEFAULT_LANGUAGE;
});
