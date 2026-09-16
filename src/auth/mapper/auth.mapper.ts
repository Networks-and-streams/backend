import { Injectable } from '@nestjs/common';
import { JwtUserDto } from '../dto/jwt-user.dto';
import type { JwtUser } from '@/common/types/jwt-payload.type';

@Injectable()
export class AuthMapper {
  toStatusResponse(user: JwtUser): JwtUserDto {
    return { id: user.id, email: user.email, sid: user.sid };
  }
}
