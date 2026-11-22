import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { OAuthProvider } from '@/generated/prisma/client';

import { OauthService } from './oauth.service';
import { PrismaContextService } from '@/core/prisma';
import { UsersService } from '@/users/users.service';
import { AuthService } from '@/auth/auth.service';
import type { NormalizedOAuthProfile } from './interfaces/normalized-oauth-profile.interface';

describe('OauthService', () => {
  let service: OauthService;

  const prismaMock = {
    oAuthAccount: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };

  const usersServiceMock = {
    findByEmail: jest.fn(),
    findByIdOrThrow: jest.fn(),
    createOAuthUser: jest.fn(),
    claimUnverifiedAccount: jest.fn(),
  };

  const authServiceMock = {
    login: jest.fn(),
  };

  const baseProfile: NormalizedOAuthProfile = {
    provider: OAuthProvider.GOOGLE,
    providerAccountId: 'google-uid-123',
    email: 'user@gmail.com',
    emailVerified: true,
    firstName: 'John',
    lastName: 'Doe',
    avatar: 'https://photo.jpg',
  };

  const meta = { ip: '127.0.0.1', userAgent: 'test-agent' };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OauthService,
        {
          provide: PrismaContextService,
          useValue: { client: prismaMock, transaction: (cb: () => Promise<unknown>) => cb() },
        },
        { provide: UsersService, useValue: usersServiceMock },
        { provide: AuthService, useValue: authServiceMock },
      ],
    }).compile();

    service = module.get<OauthService>(OauthService);
  });

  describe('login', () => {
    describe('when OAuth account already exists', () => {
      it('should return authService.login for existing account user', async () => {
        const existingAccount = {
          userId: 'existing-user-1',
          provider: OAuthProvider.GOOGLE,
          providerAccountId: 'google-uid-123',
        };
        const user = { id: 'existing-user-1', email: 'existing@gmail.com' };
        prismaMock.oAuthAccount.findUnique.mockResolvedValue(existingAccount);
        usersServiceMock.findByIdOrThrow.mockResolvedValue(user);
        authServiceMock.login.mockResolvedValue({ accessToken: 'access', refreshToken: 'refresh' });

        const result = await service.login(baseProfile, meta);

        expect(prismaMock.oAuthAccount.findUnique).toHaveBeenCalledWith({
          where: {
            provider_providerAccountId: { provider: OAuthProvider.GOOGLE, providerAccountId: 'google-uid-123' },
          },
        });
        expect(usersServiceMock.findByIdOrThrow).toHaveBeenCalledWith('existing-user-1');
        expect(authServiceMock.login).toHaveBeenCalledWith(
          { id: 'existing-user-1', email: 'existing@gmail.com', sid: '' },
          meta,
        );
        expect(usersServiceMock.findByEmail).not.toHaveBeenCalled();
        expect(usersServiceMock.createOAuthUser).not.toHaveBeenCalled();
        expect(prismaMock.oAuthAccount.create).not.toHaveBeenCalled();
        expect(result).toEqual({ accessToken: 'access', refreshToken: 'refresh' });
      });
    });

    describe('when OAuth account does not exist', () => {
      beforeEach(() => {
        prismaMock.oAuthAccount.findUnique.mockResolvedValue(null);
      });

      it('should link OAuth account and login when user with same email exists', async () => {
        const existingUser = { id: 'existing-user-2', email: 'user@gmail.com', emailVerifiedAt: new Date() };
        usersServiceMock.findByEmail.mockResolvedValue(existingUser);
        prismaMock.oAuthAccount.create.mockResolvedValue({});
        authServiceMock.login.mockResolvedValue({ accessToken: 'access', refreshToken: 'refresh' });

        const result = await service.login(baseProfile, meta);

        expect(usersServiceMock.findByEmail).toHaveBeenCalledWith('user@gmail.com');
        expect(usersServiceMock.createOAuthUser).not.toHaveBeenCalled();
        expect(prismaMock.oAuthAccount.create).toHaveBeenCalledWith({
          data: {
            provider: OAuthProvider.GOOGLE,
            providerAccountId: 'google-uid-123',
            userId: 'existing-user-2',
          },
        });
        expect(authServiceMock.login).toHaveBeenCalledWith(
          { id: 'existing-user-2', email: 'user@gmail.com', sid: '' },
          meta,
        );
        expect(result).toEqual({ accessToken: 'access', refreshToken: 'refresh' });
      });

      it('takes over an unverified local account before linking (its password was never proven)', async () => {
        usersServiceMock.findByEmail.mockResolvedValue({
          id: 'u-unverified',
          email: 'user@gmail.com',
          emailVerifiedAt: null,
        });
        prismaMock.oAuthAccount.create.mockResolvedValue({});
        authServiceMock.login.mockResolvedValue({ accessToken: 'access', refreshToken: 'refresh' });

        await service.login(baseProfile, meta);

        expect(usersServiceMock.claimUnverifiedAccount).toHaveBeenCalledWith('u-unverified');
      });

      it('refuses to link an existing account when Google has not verified the email', async () => {
        usersServiceMock.findByEmail.mockResolvedValue({
          id: 'u-1',
          email: 'user@gmail.com',
          emailVerifiedAt: new Date(),
        });

        await expect(service.login({ ...baseProfile, emailVerified: false }, meta)).rejects.toBeInstanceOf(
          ForbiddenException,
        );
        expect(prismaMock.oAuthAccount.create).not.toHaveBeenCalled();
      });

      it('should create new OAuth user, link account, and login when no user exists', async () => {
        usersServiceMock.findByEmail.mockResolvedValue(null);
        const newUser = { id: 'new-user-1', email: 'user@gmail.com' };
        usersServiceMock.createOAuthUser.mockResolvedValue(newUser);
        prismaMock.oAuthAccount.create.mockResolvedValue({});
        authServiceMock.login.mockResolvedValue({ accessToken: 'access', refreshToken: 'refresh' });

        const result = await service.login(baseProfile, meta);

        expect(usersServiceMock.createOAuthUser).toHaveBeenCalledWith({
          email: 'user@gmail.com',
          firstName: 'John',
          lastName: 'Doe',
          avatarUrl: 'https://photo.jpg',
          emailVerified: true,
        });
        expect(prismaMock.oAuthAccount.create).toHaveBeenCalledWith({
          data: {
            provider: OAuthProvider.GOOGLE,
            providerAccountId: 'google-uid-123',
            userId: 'new-user-1',
          },
        });
        expect(authServiceMock.login).toHaveBeenCalledWith(
          { id: 'new-user-1', email: 'user@gmail.com', sid: '' },
          meta,
        );
        expect(result).toEqual({ accessToken: 'access', refreshToken: 'refresh' });
      });

      it('should throw when linking OAuth account fails', async () => {
        usersServiceMock.findByEmail.mockResolvedValue(null);
        usersServiceMock.createOAuthUser.mockResolvedValue({ id: 'u1', email: 'e' });
        prismaMock.oAuthAccount.create.mockRejectedValue(new Error('Unique constraint failed'));

        await expect(service.login(baseProfile, meta)).rejects.toThrow('Unique constraint failed');
      });

      it('should handle profile with null name fields when creating user', async () => {
        const profileWithNulls: NormalizedOAuthProfile = {
          ...baseProfile,
          firstName: null,
          lastName: null,
          avatar: null,
        };
        usersServiceMock.findByEmail.mockResolvedValue(null);
        usersServiceMock.createOAuthUser.mockResolvedValue({ id: 'u2', email: 'e' });
        prismaMock.oAuthAccount.create.mockResolvedValue({});
        authServiceMock.login.mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });

        await service.login(profileWithNulls, meta);

        expect(usersServiceMock.createOAuthUser).toHaveBeenCalledWith({
          email: 'user@gmail.com',
          firstName: null,
          lastName: null,
          avatarUrl: null,
          emailVerified: true,
        });
      });
    });

    describe('edge cases', () => {
      it('should handle undefined meta fields', async () => {
        prismaMock.oAuthAccount.findUnique.mockResolvedValue(null);
        usersServiceMock.findByEmail.mockResolvedValue(null);
        usersServiceMock.createOAuthUser.mockResolvedValue({ id: 'u', email: 'e' });
        prismaMock.oAuthAccount.create.mockResolvedValue({});
        authServiceMock.login.mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });

        await service.login(baseProfile, {});

        expect(authServiceMock.login).toHaveBeenCalledWith({ id: 'u', email: 'e', sid: '' }, {});
      });
    });
  });
});
