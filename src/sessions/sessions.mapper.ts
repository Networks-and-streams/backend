import { Injectable } from '@nestjs/common';
import { SessionResponseDto } from '@/sessions/dto/session-response.dto';

@Injectable()
export class SessionsMapper {
  toResponse(
    session: {
      id: string;
      ip?: string | null;
      userAgent?: string | null;
      expiresAt: Date;
      createdAt: Date;
    },
    currentSessionId?: string,
  ): SessionResponseDto {
    return {
      id: session.id,
      ip: session.ip ?? undefined,
      userAgent: session.userAgent ?? undefined,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
      current: session.id === currentSessionId,
    };
  }

  toResponses(
    sessions: {
      id: string;
      ip?: string | null;
      userAgent?: string | null;
      expiresAt: Date;
      createdAt: Date;
    }[],
    currentSessionId?: string,
  ): SessionResponseDto[] {
    return sessions.map((session) => this.toResponse(session, currentSessionId));
  }
}
