import { Test, TestingModule } from '@nestjs/testing';

import { CookieService } from './cookie.service';
import appConfig from '@/config/loaders/app.config';
import jwtConfig from '@/config/loaders/jwt.config';
import type { Response } from 'express';

describe('CookieService', () => {
  let service: CookieService;

  const createResMock = () =>
    ({
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    }) as unknown as Response;

  const jwtConfigMock = {
    refreshTokenTtl: '7d',
  };

  describe('development environment', () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CookieService,
          {
            provide: appConfig.KEY,
            useValue: { cookieDomain: '.dev.local', cookieSecure: false, cookieSameSite: 'lax' },
          },
          { provide: jwtConfig.KEY, useValue: jwtConfigMock },
        ],
      }).compile();

      service = module.get<CookieService>(CookieService);
    });

    describe('setRefreshToken', () => {
      it('should set cookie with lax sameSite and secure false in dev', () => {
        const res = createResMock();

        service.setRefreshToken(res, 'token-123');

        expect(res.cookie).toHaveBeenCalledWith('refreshToken', 'token-123', {
          httpOnly: true,
          domain: '.dev.local',
          maxAge: 604800000,
          secure: false,
          sameSite: 'lax',
        });
      });
    });

    describe('clearRefreshToken', () => {
      it('should clear cookie with matching options in dev', () => {
        const res = createResMock();

        service.clearRefreshToken(res);

        expect(res.clearCookie).toHaveBeenCalledWith('refreshToken', {
          httpOnly: true,
          domain: '.dev.local',
          secure: false,
          sameSite: 'lax',
        });
      });
    });
  });

  describe('production environment', () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CookieService,
          {
            provide: appConfig.KEY,
            useValue: { cookieDomain: '.example.com', cookieSecure: true, cookieSameSite: 'none' },
          },
          { provide: jwtConfig.KEY, useValue: jwtConfigMock },
        ],
      }).compile();

      service = module.get<CookieService>(CookieService);
    });

    describe('setRefreshToken', () => {
      it('should set cookie with none sameSite and secure true in prod', () => {
        const res = createResMock();

        service.setRefreshToken(res, 'token-456');

        expect(res.cookie).toHaveBeenCalledWith('refreshToken', 'token-456', {
          httpOnly: true,
          domain: '.example.com',
          maxAge: 604800000,
          secure: true,
          sameSite: 'none',
        });
      });
    });

    describe('clearRefreshToken', () => {
      it('should clear cookie with matching options in prod', () => {
        const res = createResMock();

        service.clearRefreshToken(res);

        expect(res.clearCookie).toHaveBeenCalledWith('refreshToken', {
          httpOnly: true,
          domain: '.example.com',
          secure: true,
          sameSite: 'none',
        });
      });
    });
  });

  describe('undefined cookieDomain', () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CookieService,
          { provide: appConfig.KEY, useValue: { cookieDomain: undefined, cookieSecure: false, cookieSameSite: 'lax' } },
          { provide: jwtConfig.KEY, useValue: jwtConfigMock },
        ],
      }).compile();

      service = module.get<CookieService>(CookieService);
    });

    it('should pass undefined domain to cookie', () => {
      const res = createResMock();

      service.setRefreshToken(res, 'token');

      expect(res.cookie).toHaveBeenCalledWith('refreshToken', 'token', expect.objectContaining({ domain: undefined }));
    });
  });
});
