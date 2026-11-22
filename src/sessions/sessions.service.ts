import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaContextService } from '@/core/prisma';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';

/** Devices (sessions) one account may be signed in on at the same time. */
export const MAX_ACTIVE_SESSIONS = 3;

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);
  constructor(private readonly db: PrismaContextService) {}

  findAllUserSessions(userId: string) {
    return this.db.client.session.findMany({
      where: {
        userId,
        expiresAt: {
          gt: new Date(),
        },
      },
      select: {
        id: true,
        ip: true,
        userAgent: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async terminateSession(sessionId: string, userId: string) {
    const session = await this.db.client.session.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) throw new NotFoundException('Session not found');
    await this.db.client.session.delete({ where: { id: sessionId } });
    this.logger.log(`Session ${sessionId} terminated`);
  }

  async findByIdOrThrow(id: string) {
    const session = await this.db.client.session.findUnique({ where: { id } });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    return session;
  }

  removeById(id: string) {
    return this.db.client.session.delete({
      where: { id },
    });
  }

  async create(userId: string, dto: CreateSessionDto) {
    const session = await this.db.client.session.create({
      data: {
        userId,
        tokenHash: dto.tokenHash,
        expiresAt: dto.expiresAt,
        userAgent: dto.userAgent,
        ip: dto.ip,
      },
    });
    this.logger.log(`Session ${session.id} created for user ${userId}`);
    await this.enforceDeviceLimit(userId);
    return session;
  }

  /**
   * Keeps at most {@link MAX_ACTIVE_SESSIONS} sessions per user: signing in on
   * a new device signs out the least recently used one (rather than refusing
   * the login, which could lock out a user who lost a device). Expired sessions
   * are removed too. Concurrent logins converge: every caller keeps the same
   * newest sessions.
   */
  private async enforceDeviceLimit(userId: string) {
    const now = new Date();
    const active = await this.db.client.session.findMany({
      where: { userId, expiresAt: { gt: now } },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      select: { id: true },
    });
    const evictedIds = active.slice(MAX_ACTIVE_SESSIONS).map((session) => session.id);

    const result = await this.db.client.session.deleteMany({
      where: { userId, OR: [{ expiresAt: { lte: now } }, { id: { in: evictedIds } }] },
    });
    if (evictedIds.length > 0) {
      this.logger.log(`Signed out ${evictedIds.length} least recently used session(s) for user ${userId}`);
    } else if (result.count > 0) {
      this.logger.log(`Removed ${result.count} expired session(s) for user ${userId}`);
    }
  }

  findByTokenHash(tokenHash: string) {
    return this.db.client.session.findUnique({
      where: { tokenHash },
    });
  }

  async rotateToken(sid: string, oldHash: string, newHash: string, expiresAt: Date, ip?: string, userAgent?: string) {
    const result = await this.db.client.session.updateMany({
      where: {
        id: sid,
        tokenHash: oldHash,
      },
      data: {
        tokenHash: newHash,
        expiresAt,
        ip,
        userAgent,
      },
    });

    return result.count;
  }

  async removeByHash(tokenHash: string) {
    await this.db.client.session.deleteMany({
      where: { tokenHash },
    });
  }

  /** Signs out every session of the user except `keepSessionId`. */
  async removeAllExcept(userId: string, keepSessionId: string) {
    const result = await this.db.client.session.deleteMany({
      where: { userId, id: { not: keepSessionId } },
    });
    this.logger.log(`Removed ${result.count} other sessions for user ${userId}`);
  }

  async removeAllUserSessions(userId: string) {
    const result = await this.db.client.session.deleteMany({
      where: { userId },
    });
    this.logger.log(`Removed all sessions (${result.count}) for user ${userId}`);
  }

  update(id: string, dto: UpdateSessionDto) {
    return this.db.client.session.update({
      where: { id },
      data: dto,
    });
  }
}
