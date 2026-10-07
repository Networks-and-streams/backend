import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';
import { PrismaContextService } from '@/core/prisma';
import { SessionsService } from '@/sessions/sessions.service';
import { BadRequestException } from '@nestjs/common';
import { SubscriptionPlan, SubscriptionStatus } from '@/generated/prisma/client';
jest.mock('bcrypt');

function createMockTx() {
  return {
    user: { create: jest.fn() },
    subscription: { create: jest.fn() },
  };
}

function createMockPrismaService() {
  const tx = createMockTx();
  return {
    $transaction: jest.fn((fn: (txArg: ReturnType<typeof createMockTx>) => Promise<any>) => fn(tx)),
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    subscription: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
  };
}

describe('UsersService', () => {
  let service: UsersService;
  let prisma: ReturnType<typeof createMockPrismaService>;
  const sessions = { removeAllExcept: jest.fn() };

  const baseUser = {
    id: '1',
    email: 'test@test.com',
    password: 'hash',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaContextService,
          useValue: { client: prisma, transaction: (cb: () => Promise<unknown>) => cb() },
        },
        { provide: SessionsService, useValue: sessions },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('hashes password with bcrypt and creates user + inactive subscription in a transaction', async () => {
      const hashed = 'hashed-password';
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashed);

      const tx = createMockTx();
      prisma.$transaction.mockImplementation((fn: (t: ReturnType<typeof createMockTx>) => Promise<any>) => fn(tx));

      const expectedUser = { id: '1', email: 'test@test.com', password: hashed };
      tx.user.create.mockResolvedValue(expectedUser);
      tx.subscription.create.mockResolvedValue({ userId: '1' });

      const result = await service.create('test@test.com', 'plain-password');

      expect(bcrypt.hash).toHaveBeenCalledWith('plain-password', 10);
      expect(tx.user.create).toHaveBeenCalledWith({
        data: { email: 'test@test.com', password: hashed },
      });
      expect(tx.subscription.create).toHaveBeenCalledWith({
        data: {
          userId: '1',
          status: SubscriptionStatus.INACTIVE,
          plan: SubscriptionPlan.FREE,
        },
      });
      expect(result).toEqual(expectedUser);
    });

    it('throws when bcrypt.hash rejects', async () => {
      (bcrypt.hash as jest.Mock).mockRejectedValue(new Error('bcrypt error'));

      await expect(service.create('test@test.com', 'password')).rejects.toThrow('bcrypt error');
    });
  });

  describe('createOAuthUser', () => {
    it('creates user and inactive subscription in a transaction without hashing password', async () => {
      const tx = createMockTx();
      prisma.$transaction.mockImplementation((fn: (t: ReturnType<typeof createMockTx>) => Promise<any>) => fn(tx));

      const expectedUser = { id: 'oauth-user-1', email: 'oauth@test.com', password: null };
      tx.user.create.mockResolvedValue(expectedUser);
      tx.subscription.create.mockResolvedValue({ userId: 'oauth-user-1' });

      const result = await service.createOAuthUser({
        email: 'oauth@test.com',
        firstName: 'OAuth',
        lastName: 'User',
        avatarUrl: 'https://avatar.jpg',
      });

      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(tx.user.create).toHaveBeenCalledWith({
        data: { email: 'oauth@test.com' },
      });
      expect(tx.subscription.create).toHaveBeenCalledWith({
        data: {
          userId: 'oauth-user-1',
          status: SubscriptionStatus.INACTIVE,
          plan: SubscriptionPlan.FREE,
        },
      });
      expect(result).toEqual(expectedUser);
    });

    it('creates user with null optional fields', async () => {
      const tx = createMockTx();
      prisma.$transaction.mockImplementation((fn: (t: ReturnType<typeof createMockTx>) => Promise<any>) => fn(tx));

      tx.user.create.mockResolvedValue({ id: 'u2', email: 'e', password: null });
      tx.subscription.create.mockResolvedValue({ userId: 'u2' });

      await service.createOAuthUser({ email: 'e@test.com' });

      expect(tx.user.create).toHaveBeenCalledWith({
        data: { email: 'e@test.com' },
      });
      expect(tx.subscription.create).toHaveBeenCalledWith({
        data: {
          userId: 'u2',
          status: SubscriptionStatus.INACTIVE,
          plan: SubscriptionPlan.FREE,
        },
      });
    });

    it('propagates prisma transaction errors', async () => {
      prisma.$transaction.mockRejectedValue(new Error('Transaction failed'));

      await expect(service.createOAuthUser({ email: 'fail@test.com' })).rejects.toThrow('Transaction failed');
    });
  });

  describe('findByEmail', () => {
    it('calls prisma.user.findUnique with the given email', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);

      const result = await service.findByEmail('test@test.com');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'test@test.com' } });
      expect(result).toEqual(baseUser);
    });
  });

  describe('findUserById', () => {
    it('calls prisma.user.findUnique with the given id', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);

      const result = await service.findUserById('1');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: '1' } });
      expect(result).toEqual(baseUser);
    });
  });

  describe('getAllUsers', () => {
    it('calls prisma.user.findMany and returns users', async () => {
      const users = [baseUser];
      prisma.user.findMany.mockResolvedValue(users);

      const result = await service.getAllUsers();

      expect(prisma.user.findMany).toHaveBeenCalledWith();
      expect(result).toEqual(users);
    });
  });

  describe('removeUserById', () => {
    it('calls findByIdOrThrow then prisma.user.delete', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);
      prisma.user.delete.mockResolvedValue(baseUser);

      const result = await service.removeUserById('1');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: '1' } });
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: '1' } });
      expect(result).toEqual(baseUser);
    });
  });

  describe('changePassword', () => {
    const compare = bcrypt.compare as jest.Mock;
    const hash = bcrypt.hash as jest.Mock;

    it('changes the password and signs out every other session', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);
      compare.mockResolvedValueOnce(true).mockResolvedValueOnce(false); // current ok, new differs
      hash.mockResolvedValue('new-hash');

      await service.changePassword('1', 'session-1', { currentPassword: 'old', newPassword: 'new-pass' });

      expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: '1' }, data: { password: 'new-hash' } });
      expect(sessions.removeAllExcept).toHaveBeenCalledWith('1', 'session-1');
    });

    it('rejects a wrong current password with 400 and changes nothing', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);
      compare.mockResolvedValueOnce(false);

      await expect(
        service.changePassword('1', 'session-1', { currentPassword: 'wrong', newPassword: 'new-pass' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(sessions.removeAllExcept).not.toHaveBeenCalled();
    });

    it('requires the current password when one is set', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);

      await expect(service.changePassword('1', 'session-1', { newPassword: 'new-pass' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('lets a Google-only account set a first password without a current one', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...baseUser, password: null });
      hash.mockResolvedValue('first-hash');

      await service.changePassword('1', 'session-1', { newPassword: 'new-pass' });

      expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: '1' }, data: { password: 'first-hash' } });
    });
  });
});
