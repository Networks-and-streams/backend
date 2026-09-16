import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { SessionsService } from './sessions.service';
import { PrismaService } from '@/core/prisma/prisma.service';

function createMockPrismaService() {
  return {
    session: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      updateMany: jest.fn(),
    },
  };
}

describe('SessionsService', () => {
  let service: SessionsService;
  let prisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [SessionsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<SessionsService>(SessionsService);
    jest.clearAllMocks();
  });

  describe('findAllUserSessions', () => {
    it('calls prisma.session.findMany with userId and active filter', async () => {
      const sessions = [
        { id: '1', ip: '127.0.0.1', userAgent: 'test-agent', expiresAt: new Date(), createdAt: new Date() },
      ];
      prisma.session.findMany.mockResolvedValue(sessions);

      const result = await service.findAllUserSessions('user-1');

      expect(prisma.session.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          expiresAt: { gt: expect.any(Date) as Date },
        },
        select: {
          id: true,
          ip: true,
          userAgent: true,
          expiresAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(sessions);
    });
  });

  describe('terminateSession', () => {
    it('finds session then deletes it', async () => {
      prisma.session.findFirst.mockResolvedValue({ id: 'session-1', userId: 'user-1' });
      prisma.session.delete.mockResolvedValue({ id: 'session-1' } as any);

      await expect(service.terminateSession('session-1', 'user-1')).resolves.toBeUndefined();

      expect(prisma.session.findFirst).toHaveBeenCalledWith({
        where: { id: 'session-1', userId: 'user-1' },
      });
      expect(prisma.session.delete).toHaveBeenCalledWith({
        where: { id: 'session-1' },
      });
    });

    it('throws NotFoundException when session is not found', async () => {
      prisma.session.findFirst.mockResolvedValue(null);

      await expect(service.terminateSession('nonexistent', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeOtherUserSessions', () => {
    it('calls deleteMany with NOT condition using hash when a token is provided', async () => {
      const refreshToken = 'some-token';
      const hashHex = crypto.createHash('sha256').update(refreshToken).digest('hex');
      prisma.session.deleteMany.mockResolvedValue({ count: 1 });

      await service.removeOtherUserSessions('user-1', refreshToken);

      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          NOT: { tokenHash: hashHex },
        },
      });
    });

    it('calls deleteMany without NOT when no token is provided', async () => {
      prisma.session.deleteMany.mockResolvedValue({ count: 0 });

      await service.removeOtherUserSessions('user-1', undefined);

      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          NOT: undefined,
        },
      });
    });
  });

  describe('findByIdOrThrow', () => {
    it('returns the session when found', async () => {
      const session = { id: 'session-1', userId: 'user-1', tokenHash: 'hash', expiresAt: new Date() };
      prisma.session.findUnique.mockResolvedValue(session);

      const result = await service.findByIdOrThrow('session-1');

      expect(prisma.session.findUnique).toHaveBeenCalledWith({ where: { id: 'session-1' } });
      expect(result).toEqual(session);
    });

    it('throws NotFoundException when session is not found', async () => {
      prisma.session.findUnique.mockResolvedValue(null);

      await expect(service.findByIdOrThrow('nonexistent')).rejects.toThrow(NotFoundException);

      expect(prisma.session.findUnique).toHaveBeenCalledWith({ where: { id: 'nonexistent' } });
    });
  });

  describe('removeById', () => {
    it('calls prisma.session.delete with the given id', async () => {
      const session = { id: 'session-1', userId: 'user-1' };
      prisma.session.delete.mockResolvedValue(session);

      const result = await service.removeById('session-1');

      expect(prisma.session.delete).toHaveBeenCalledWith({ where: { id: 'session-1' } });
      expect(result).toEqual(session);
    });
  });

  describe('create', () => {
    it('calls prisma.session.create with the userId and dto data', async () => {
      const dto = { tokenHash: 'hash', expiresAt: new Date(), ip: '127.0.0.1', userAgent: 'agent' };
      const session = { id: 'session-1', userId: 'user-1', ...dto };
      prisma.session.create.mockResolvedValue(session);

      const result = await service.create('user-1', dto);

      expect(prisma.session.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          tokenHash: 'hash',
          expiresAt: dto.expiresAt,
          userAgent: 'agent',
          ip: '127.0.0.1',
        },
      });
      expect(result).toEqual(session);
    });
  });

  describe('findByTokenHash', () => {
    it('calls prisma.session.findUnique with the tokenHash', async () => {
      const session = { id: 'session-1', tokenHash: 'hash' };
      prisma.session.findUnique.mockResolvedValue(session);

      const result = await service.findByTokenHash('hash');

      expect(prisma.session.findUnique).toHaveBeenCalledWith({ where: { tokenHash: 'hash' } });
      expect(result).toEqual(session);
    });
  });

  describe('removeByHash', () => {
    it('calls prisma.session.deleteMany with the tokenHash', async () => {
      prisma.session.deleteMany.mockResolvedValue({ count: 1 } as any);

      await service.removeByHash('hash');

      expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { tokenHash: 'hash' } });
    });
  });

  describe('update', () => {
    it('calls prisma.session.update with the id and dto data', async () => {
      const dto = { tokenHash: 'new-hash', expiresAt: new Date('2026-12-31') };
      const updated = { id: 'session-1', userId: 'user-1', ...dto };
      prisma.session.update.mockResolvedValue(updated);

      const result = await service.update('session-1', dto);

      expect(prisma.session.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: dto,
      });
      expect(result).toEqual(updated);
    });

    it('propagates prisma errors when session not found', async () => {
      prisma.session.update.mockRejectedValue(new Error('Record to update not found'));

      await expect(service.update('nonexistent', { tokenHash: 'h' })).rejects.toThrow('Record to update not found');
    });
  });

  describe('rotateToken', () => {
    it('calls prisma.session.updateMany with correct params and returns count', async () => {
      const expiresAt = new Date('2026-12-31');
      prisma.session.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.rotateToken('session-1', 'old-hash', 'new-hash', expiresAt, '10.0.0.1', 'agent');

      expect(prisma.session.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'session-1',
          tokenHash: 'old-hash',
        },
        data: {
          tokenHash: 'new-hash',
          expiresAt,
          ip: '10.0.0.1',
          userAgent: 'agent',
        },
      });
      expect(result).toBe(1);
    });

    it('returns 0 when no rows match', async () => {
      prisma.session.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.rotateToken('session-1', 'old', 'new', new Date());

      expect(result).toBe(0);
    });

    it('handles undefined ip and userAgent', async () => {
      prisma.session.updateMany.mockResolvedValue({ count: 1 });

      await service.rotateToken('session-1', 'old', 'new', new Date());

      expect(prisma.session.updateMany).toHaveBeenCalledWith({
        where: { id: 'session-1', tokenHash: 'old' },
        data: { tokenHash: 'new', expiresAt: expect.any(Date) as Date, ip: undefined, userAgent: undefined },
      });
    });
  });

  describe('removeAllUserSessions', () => {
    it('calls prisma.session.deleteMany with the userId', async () => {
      prisma.session.deleteMany.mockResolvedValue({ count: 3 });

      await service.removeAllUserSessions('user-1');

      expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
    });
  });
});
