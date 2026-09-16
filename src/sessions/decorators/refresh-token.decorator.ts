import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

interface RequestWithCookies extends Request {
  cookies: {
    refreshToken?: string;
    [key: string]: unknown;
  };
}

export const RefreshToken = createParamDecorator((_: unknown, ctx: ExecutionContext): string | undefined => {
  const request = ctx.switchToHttp().getRequest<RequestWithCookies>();

  return request.cookies?.refreshToken;
});
