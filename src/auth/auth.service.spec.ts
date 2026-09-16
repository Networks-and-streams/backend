import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'node:crypto';

import { AuthService } from './auth.service';
import { TokenService } from './services/token.service';
import { UsersService } from '@/users/users.service';
import { SessionsService } from '@/sessions/sessions.service';
import jwtConfig from '@/config/loaders/jwt.config';
import type { JwtUser, RefreshJwtPayload } from '@/common/types/jwt-payload.type';
import { RegisterDto } from './dto/register.dto';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
}));

const mockHash = {
  update: jest.fn().mockReturnThis(),
  digest: jest.fn().mockReturnValue('mocked-hash'),
};

jest.mock('node:crypto', () => ({
  createHash: jest.fn(() => mockHash),
  randomUUID: jest.fn().mockReturnValue('mocked-uuid'),
}));

describe('AuthService', () => {
  let service: AuthService;

  const tokenServiceMock = {
    generate: jest.fn(),
    accessToken: jest.fn(),
    refreshToken: jest.fn(),
  };

  const usersServiceMock = {
    findUserById: jest.fn(),
    findByIdOrThrow: jest.fn(),
    findByEmail: jest.fn(),
    create: jest.fn(),
  };

  const sessionsServiceMock = {
    create: jest.fn(),
    findByIdOrThrow: jest.fn(),
    update: jest.fn(),
    rotateToken: jest.fn(),
    findByTokenHash: jest.fn(),
    removeByHash: jest.fn(),
    removeAllUserSessions: jest.fn(),
  };

  const jwtConfigMock = {
    refreshTokenTtl: '7d',
  };

  const baseUser = {
    id: 'user-1',
    email: 'test@example.com',
    password: 'hashed-password',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const validSession = {
    id: 'session-1',
    userId: 'user-1',
    tokenHash: 'mocked-hash',
    expiresAt: new Date('2099-01-01'),
    createdAt: new Date('2024-01-01'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: TokenService, useValue: tokenServiceMock },
        { provide: UsersService, useValue: usersServiceMock },
        { provide: SessionsService, useValue: sessionsServiceMock },
        { provide: jwtConfig.KEY, useValue: jwtConfigMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateUser', () => {
    it('should return user data when user exists', async () => {
      usersServiceMock.findUserById.mockResolvedValue(baseUser);

      const result = await service.validateUser('user-1');

      expect(usersServiceMock.findUserById).toHaveBeenCalledWith('user-1');
      expect(result).toBeTruthy();
      expect(result!.id).toBe('user-1');
      expect(result!.email).toBe('test@example.com');
    });

    it('should return null when user does not exist', async () => {
      usersServiceMock.findUserById.mockResolvedValue(null);

      const result = await service.validateUser('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('validateCredentials', () => {
    it('should return user data when credentials are valid', async () => {
      usersServiceMock.findByEmail.mockResolvedValue(baseUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateCredentials('test@example.com', 'password');

      expect(usersServiceMock.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(bcrypt.compare).toHaveBeenCalledWith('password', 'hashed-password');
      expect(result).toBeTruthy();
      expect(result!.id).toBe('user-1');
    });

    it('should return null when user not found by email', async () => {
      usersServiceMock.findByEmail.mockResolvedValue(null);

      const result = await service.validateCredentials('unknown@example.com', 'password');

      expect(result).toBeNull();
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should return null when password does not match', async () => {
      usersServiceMock.findByEmail.mockResolvedValue(baseUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.validateCredentials('test@example.com', 'wrong-password');

      expect(result).toBeNull();
      expect(bcrypt.compare).toHaveBeenCalledWith('wrong-password', 'hashed-password');
    });
  });

  describe('login', () => {
    it('should create session, generate tokens, update session hash, and return both tokens', async () => {
      const user: JwtUser = { id: 'user-1', email: 'user-1@example.com', sid: '' };
      const meta = { ip: '127.0.0.1', userAgent: 'test-agent' };

      sessionsServiceMock.create.mockResolvedValue({ id: 'session-new' });
      tokenServiceMock.generate.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });

      const result = await service.login(user, meta);

      expect(sessionsServiceMock.create).toHaveBeenCalledWith('user-1', {
        expiresAt: expect.any(Date) as Date,
        ip: '127.0.0.1',
        userAgent: 'test-agent',
      });
      expect(tokenServiceMock.generate).toHaveBeenCalledWith('user-1', 'user-1@example.com', 'session-new');
      expect(sessionsServiceMock.update).toHaveBeenCalledWith('session-new', { tokenHash: 'mocked-hash' });
      expect(result).toEqual({ accessToken: 'access-token', refreshToken: 'refresh-token' });
    });
  });

  describe('register', () => {
    it('should throw BadRequestException when email already exists', async () => {
      const dto = {
        email: 'test@example.com',
        password: 'password123',
      } satisfies RegisterDto;

      const meta = { ip: '127.0.0.1', userAgent: 'test-agent' };

      usersServiceMock.findByEmail.mockResolvedValue(baseUser);

      await expect(service.register(dto, meta)).rejects.toThrow(BadRequestException);

      expect(usersServiceMock.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(usersServiceMock.create).not.toHaveBeenCalled();
    });

    it('should throw when user creation returns null', async () => {
      const dto = {
        email: 'new@example.com',
        password: 'password123',
      } satisfies RegisterDto;

      const meta = { ip: '127.0.0.1', userAgent: 'test-agent' };

      usersServiceMock.findByEmail.mockResolvedValue(null);
      usersServiceMock.create.mockResolvedValue(null);

      await expect(service.register(dto, meta)).rejects.toThrow();

      expect(usersServiceMock.create).toHaveBeenCalledWith('new@example.com', 'password123');
    });

    it('should register and return both tokens', async () => {
      const dto = {
        email: 'new@example.com',
        password: 'password123',
      } satisfies RegisterDto;
      const meta = { ip: '127.0.0.1', userAgent: 'test-agent' };

      const newUser = { ...baseUser, id: 'new-user-1', email: 'new@example.com' };
      usersServiceMock.findByEmail.mockResolvedValue(null);
      usersServiceMock.create.mockResolvedValue(newUser);
      sessionsServiceMock.create.mockResolvedValue({ id: 'session-new' });
      tokenServiceMock.generate.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });

      const result = await service.register(dto, meta);

      expect(usersServiceMock.findByEmail).toHaveBeenCalledWith('new@example.com');
      expect(usersServiceMock.create).toHaveBeenCalledWith('new@example.com', 'password123');
      expect(sessionsServiceMock.create).toHaveBeenCalled();
      expect(tokenServiceMock.generate).toHaveBeenCalledWith('new-user-1', 'new@example.com', 'session-new');
      expect(result).toEqual({ accessToken: 'access-token', refreshToken: 'refresh-token' });
    });
  });

  describe('refresh', () => {
    const meta = { ip: '127.0.0.1', userAgent: 'test-agent' };
    const payload: RefreshJwtPayload = { id: 'user-1', sid: 'session-1', jti: 'jti-1' };
    const oldRefreshToken = 'old-refresh-token';

    it('should propagate error when session not found', async () => {
      sessionsServiceMock.findByIdOrThrow.mockRejectedValue(new Error('Session not found'));

      await expect(service.refresh(payload, oldRefreshToken, meta)).rejects.toThrow('Session not found');
    });

    it('should throw UnauthorizedException when session is expired', async () => {
      const expiredSession = {
        ...validSession,
        expiresAt: new Date('2020-01-01'),
      };
      sessionsServiceMock.findByIdOrThrow.mockResolvedValue(expiredSession);

      await expect(service.refresh(payload, oldRefreshToken, meta)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when token hash does not match', async () => {
      const mismatchedSession = {
        ...validSession,
        tokenHash: 'different-hash',
      };
      sessionsServiceMock.findByIdOrThrow.mockResolvedValue(mismatchedSession);

      await expect(service.refresh(payload, oldRefreshToken, meta)).rejects.toThrow(UnauthorizedException);
    });

    it('should perform atomic rotation and return both tokens', async () => {
      sessionsServiceMock.findByIdOrThrow.mockResolvedValue(validSession);
      tokenServiceMock.refreshToken.mockResolvedValue('new-refresh-token');
      tokenServiceMock.accessToken.mockResolvedValue('new-access-token');
      sessionsServiceMock.rotateToken.mockResolvedValue(1);
      usersServiceMock.findByIdOrThrow.mockResolvedValue(baseUser);

      const result = await service.refresh(payload, oldRefreshToken, meta);

      expect(sessionsServiceMock.findByIdOrThrow).toHaveBeenCalledWith('session-1');
      expect(tokenServiceMock.refreshToken).toHaveBeenCalledWith('user-1', 'session-1');
      expect(sessionsServiceMock.rotateToken).toHaveBeenCalledWith(
        'session-1',
        'mocked-hash',
        'mocked-hash',
        expect.any(Date),
        '127.0.0.1',
        'test-agent',
      );
      expect(usersServiceMock.findByIdOrThrow).toHaveBeenCalledWith('user-1');
      expect(tokenServiceMock.accessToken).toHaveBeenCalledWith('user-1', 'test@example.com', 'session-1');
      expect(result).toEqual({ accessToken: 'new-access-token', refreshToken: 'new-refresh-token' });
    });

    it('should throw UnauthorizedException when atomic rotation affects 0 rows', async () => {
      sessionsServiceMock.findByIdOrThrow.mockResolvedValue(validSession);
      tokenServiceMock.refreshToken.mockResolvedValue('new-refresh-token');
      sessionsServiceMock.rotateToken.mockResolvedValue(0);

      await expect(service.refresh(payload, oldRefreshToken, meta)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should remove session when refreshToken provided', async () => {
      const refreshToken = 'some-refresh-token';

      await service.logout(refreshToken);

      expect(crypto.createHash).toHaveBeenCalledWith('sha256');
      expect(mockHash.update).toHaveBeenCalledWith(refreshToken);
      expect(sessionsServiceMock.removeByHash).toHaveBeenCalledWith('mocked-hash');
    });

    it('should not remove session when no refreshToken', async () => {
      await service.logout();

      expect(sessionsServiceMock.removeByHash).not.toHaveBeenCalled();
    });
  });

  describe('logoutAllDevices', () => {
    it('should remove all sessions for user', async () => {
      sessionsServiceMock.removeAllUserSessions.mockResolvedValue(undefined);

      await service.logoutAllDevices('user-1');

      expect(sessionsServiceMock.removeAllUserSessions).toHaveBeenCalledWith('user-1');
    });
  });
});
