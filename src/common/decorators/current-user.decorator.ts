import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

import type { JwtUser } from '@/common/types/jwt-payload.type';

export const CurrentUser = createParamDecorator((data: keyof JwtUser | undefined, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<Request>();

  const user = request.user as unknown as JwtUser | undefined;

  if (!user) {
    return null;
  }

  return data ? user[data] : user;
});
