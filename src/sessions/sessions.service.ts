import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaContextService } from '@/core/prisma';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import * as crypto from 'node:crypto';

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

  async removeOtherUserSessions(userId: string, currentRefreshToken?: string) {
    const currentHash = currentRefreshToken
      ? crypto.createHash('sha256').update(currentRefreshToken).digest('hex')
      : undefined;

    const result = await this.db.client.session.deleteMany({
      where: {
        userId,
        NOT: currentHash
          ? {
              tokenHash: currentHash,
            }
          : undefined,
      },
    });
    this.logger.log(`Removed ${result.count} other sessions for user ${userId}`);
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
    return session;
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
