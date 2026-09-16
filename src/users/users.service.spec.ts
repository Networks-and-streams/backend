import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';
import { PrismaService } from '@/core/prisma/prisma.service';
jest.mock('bcrypt');

function createMockTx() {
  return {
    user: { create: jest.fn() },
    profile: { create: jest.fn() },
    statistics: { create: jest.fn() },
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
      delete: jest.fn(),
    },
    profile: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    session: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      update: jest.fn(),
    },
    statistics: {
      create: jest.fn(),
    },
  };
}

describe('UsersService', () => {
  let service: UsersService;
  let prisma: ReturnType<typeof createMockPrismaService>;

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
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('hashes password with bcrypt and creates user+profile+statistics in a transaction', async () => {
      const hashed = 'hashed-password';
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashed);

      const tx = createMockTx();
      prisma.$transaction.mockImplementation((fn: (t: ReturnType<typeof createMockTx>) => Promise<any>) => fn(tx));

      const expectedUser = { id: '1', email: 'test@test.com', password: hashed };
      tx.user.create.mockResolvedValue(expectedUser);
      tx.profile.create.mockResolvedValue({ userId: '1' });
      tx.statistics.create.mockResolvedValue({ userId: '1' });

      const result = await service.create('test@test.com', 'plain-password');

      expect(bcrypt.hash).toHaveBeenCalledWith('plain-password', 10);
      expect(tx.user.create).toHaveBeenCalledWith({
        data: { email: 'test@test.com', password: hashed },
      });
      expect(tx.profile.create).toHaveBeenCalledWith({
        data: { userId: '1' },
      });
      expect(tx.statistics.create).toHaveBeenCalledWith({
        data: { userId: '1' },
      });
      expect(result).toEqual(expectedUser);
    });

    it('throws when bcrypt.hash rejects', async () => {
      (bcrypt.hash as jest.Mock).mockRejectedValue(new Error('bcrypt error'));

      await expect(service.create('test@test.com', 'password')).rejects.toThrow('bcrypt error');
    });
  });

  describe('createOAuthUser', () => {
    it('creates user and profile in a transaction without hashing password', async () => {
      const tx = createMockTx();
      prisma.$transaction.mockImplementation((fn: (t: ReturnType<typeof createMockTx>) => Promise<any>) => fn(tx));

      const expectedUser = { id: 'oauth-user-1', email: 'oauth@test.com', password: null };
      tx.user.create.mockResolvedValue(expectedUser);
      tx.profile.create.mockResolvedValue({ userId: 'oauth-user-1' });

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
      expect(tx.profile.create).toHaveBeenCalledWith({
        data: {
          userId: 'oauth-user-1',
          firstName: 'OAuth',
          lastName: 'User',
          avatarUrl: 'https://avatar.jpg',
        },
      });
      expect(result).toEqual(expectedUser);
    });

    it('creates user with null optional fields', async () => {
      const tx = createMockTx();
      prisma.$transaction.mockImplementation((fn: (t: ReturnType<typeof createMockTx>) => Promise<any>) => fn(tx));

      tx.user.create.mockResolvedValue({ id: 'u2', email: 'e', password: null });
      tx.profile.create.mockResolvedValue({ userId: 'u2' });

      await service.createOAuthUser({ email: 'e@test.com' });

      expect(tx.profile.create).toHaveBeenCalledWith({
        data: {
          userId: 'u2',
          firstName: undefined,
          lastName: undefined,
          avatarUrl: undefined,
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
});
