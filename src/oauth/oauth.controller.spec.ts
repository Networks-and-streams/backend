import { Test, TestingModule } from '@nestjs/testing';

import { OauthController } from './oauth.controller';
import { OauthService } from './oauth.service';
import { CookieService } from '@/auth/services/cookie.service';
import { NormalizedOAuthProfile } from './interfaces/normalized-oauth-profile.interface';
import { OAuthProvider } from '@/generated/prisma/client';
import appConfig from '@/config/loaders/app.config';
import type { Response } from 'express';

describe('OauthController', () => {
  let controller: OauthController;

  const oauthServiceMock = {
    login: jest.fn(),
  };

  const cookieServiceMock = {
    setRefreshToken: jest.fn(),
    clearRefreshToken: jest.fn(),
  };

  const mockAppConfig = {
    frontendUrl: 'http://myapp.com',
  };

  const createResMock = () =>
    ({
      redirect: jest.fn(),
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    }) as unknown as Response;

  const createReqMock = (user?: NormalizedOAuthProfile, overrides?: Record<string, unknown>) =>
    ({
      user,
      ip: '127.0.0.1',
      headers: { 'user-agent': 'test-agent' },
      cookies: {},
      ...overrides,
    }) as never;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OauthController],
      providers: [
        { provide: OauthService, useValue: oauthServiceMock },
        { provide: CookieService, useValue: cookieServiceMock },
        { provide: appConfig.KEY, useValue: mockAppConfig },
      ],
    }).compile();

    controller = module.get<OauthController>(OauthController);
  });

  describe('google', () => {
    it('should be defined (guard handles the redirect)', () => {
      expect(() => controller.google()).not.toThrow();
    });
  });

  describe('callback', () => {
    const mockProfile: NormalizedOAuthProfile = {
      provider: OAuthProvider.GOOGLE,
      providerAccountId: 'google-123',
      email: 'user@gmail.com',
      firstName: 'John',
      lastName: 'Doe',
      avatar: 'https://photo.jpg',
    };

    it('should call oauthService.login with profile and meta, set cookie, and redirect', async () => {
      const res = createResMock();
      const req = createReqMock(mockProfile);
      oauthServiceMock.login.mockResolvedValue({ accessToken: 'access-token', refreshToken: 'refresh-token' });

      await controller.callback(req, res);

      expect(oauthServiceMock.login).toHaveBeenCalledWith(mockProfile, { ip: '127.0.0.1', userAgent: 'test-agent' });
      expect(cookieServiceMock.setRefreshToken).toHaveBeenCalledWith(res, 'refresh-token');
      expect(res.redirect).toHaveBeenCalledWith('http://myapp.com/auth/callback');
    });

    it('should use frontendUrl from appConfig', async () => {
      const res = createResMock();
      const req = createReqMock(mockProfile);
      oauthServiceMock.login.mockResolvedValue({ accessToken: 'at', refreshToken: 'rt' });

      await controller.callback(req, res);

      expect(res.redirect).toHaveBeenCalledWith('http://myapp.com/auth/callback');
    });

    it('should propagate errors from oauthService.login', async () => {
      const res = createResMock();
      const req = createReqMock(mockProfile);
      oauthServiceMock.login.mockRejectedValue(new Error('OAuth failed'));

      await expect(controller.callback(req, res)).rejects.toThrow('OAuth failed');
    });

    it('should extract ip and userAgent from request', async () => {
      const res = createResMock();
      const req = createReqMock(mockProfile, { ip: '10.0.0.1', headers: { 'user-agent': 'custom-agent' } });
      oauthServiceMock.login.mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });

      await controller.callback(req, res);

      expect(oauthServiceMock.login).toHaveBeenCalledWith(mockProfile, { ip: '10.0.0.1', userAgent: 'custom-agent' });
    });
  });
});
