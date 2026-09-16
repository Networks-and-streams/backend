import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CookieService } from './services/cookie.service';
import { AuthMapper } from './mapper/auth.mapper';
import type { JwtUser, RefreshJwtPayload } from '@/common/types/jwt-payload.type';

describe('AuthController', () => {
  let controller: AuthController;

  const authServiceMock = {
    register: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
    refresh: jest.fn(),
    logoutAllDevices: jest.fn(),
  };

  const cookieServiceMock = {
    setRefreshToken: jest.fn(),
    clearRefreshToken: jest.fn(),
  };

  const authMapperMock = {
    toStatusResponse: jest.fn(),
  };

  const createResMock = () =>
    ({
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    }) as never;

  const createReqMock = (overrides?: Record<string, unknown>) =>
    ({
      ip: '127.0.0.1',
      headers: { 'user-agent': 'test-agent' },
      cookies: {},
      ...overrides,
    }) as never;

  const mockUser: JwtUser = { id: 'user-1', email: 'user-1@example.com', sid: '' };

  const mockRefreshPayload: RefreshJwtPayload = { id: 'user-1', sid: 'session-1', jti: 'jti-1' };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authServiceMock },
        { provide: CookieService, useValue: cookieServiceMock },
        { provide: AuthMapper, useValue: authMapperMock },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  describe('register', () => {
    it('should call authService.register with dto and meta, set cookie, and return accessToken', async () => {
      const res = createResMock();
      const req = createReqMock();
      const dto = { email: 'test@example.com', password: 'password123' };
      authServiceMock.register.mockResolvedValue({ accessToken: 'access-token', refreshToken: 'refresh-token' });

      const result = await controller.register(res, req, dto as never);

      expect(authServiceMock.register).toHaveBeenCalledWith(dto, { ip: '127.0.0.1', userAgent: 'test-agent' });
      expect(cookieServiceMock.setRefreshToken).toHaveBeenCalledWith(res, 'refresh-token');
      expect(result).toEqual({ accessToken: 'access-token' });
    });

    it('should pass through undefined ip when req.ip is undefined', async () => {
      const res = createResMock();
      const req = createReqMock({ ip: undefined });
      const dto = { email: 'a@b.com', password: 'pass123' };
      authServiceMock.register.mockResolvedValue({ accessToken: 'at', refreshToken: 'rt' });

      await controller.register(res, req, dto as never);

      expect(authServiceMock.register).toHaveBeenCalledWith(dto, { ip: undefined, userAgent: 'test-agent' });
    });
  });

  describe('login', () => {
    it('should call authService.login with user and meta, set cookie, and return accessToken', async () => {
      const res = createResMock();
      const req = createReqMock();
      authServiceMock.login.mockResolvedValue({ accessToken: 'access-token', refreshToken: 'refresh-token' });

      const result = await controller.login(res, req, mockUser);

      expect(authServiceMock.login).toHaveBeenCalledWith(mockUser, { ip: '127.0.0.1', userAgent: 'test-agent' });
      expect(cookieServiceMock.setRefreshToken).toHaveBeenCalledWith(res, 'refresh-token');
      expect(result).toEqual({ accessToken: 'access-token' });
    });
  });

  describe('logout', () => {
    it('should extract refreshToken from cookies, call authService.logout, and clear cookie', async () => {
      const res = createResMock();
      const req = createReqMock({ cookies: { refreshToken: 'my-token' } });
      authServiceMock.logout.mockResolvedValue(undefined);

      const result = await controller.logout(res, req);

      expect(authServiceMock.logout).toHaveBeenCalledWith('my-token');
      expect(cookieServiceMock.clearRefreshToken).toHaveBeenCalledWith(res);
      expect(result).toEqual({ message: 'Successfully logged out.' });
    });

    it('should pass undefined when no refreshToken cookie', async () => {
      const res = createResMock();
      const req = createReqMock();
      authServiceMock.logout.mockResolvedValue(undefined);

      const result = await controller.logout(res, req);

      expect(authServiceMock.logout).toHaveBeenCalledWith(undefined);
      expect(cookieServiceMock.clearRefreshToken).toHaveBeenCalledWith(res);
      expect(result).toEqual({ message: 'Successfully logged out.' });
    });
  });

  describe('refresh', () => {
    it('should throw UnauthorizedException when refreshToken cookie is missing', async () => {
      const res = createResMock();
      const req = createReqMock();

      await expect(controller.refresh(res, req, mockRefreshPayload)).rejects.toThrow(UnauthorizedException);

      expect(authServiceMock.refresh).not.toHaveBeenCalled();
      expect(cookieServiceMock.setRefreshToken).not.toHaveBeenCalled();
    });

    it('should call authService.refresh with payload, old token, and meta; set cookie and return accessToken', async () => {
      const res = createResMock();
      const req = createReqMock({ cookies: { refreshToken: 'old-token' } });
      authServiceMock.refresh.mockResolvedValue({ accessToken: 'new-access', refreshToken: 'new-refresh' });

      const result = await controller.refresh(res, req, mockRefreshPayload);

      expect(authServiceMock.refresh).toHaveBeenCalledWith(mockRefreshPayload, 'old-token', {
        ip: '127.0.0.1',
        userAgent: 'test-agent',
      });
      expect(cookieServiceMock.setRefreshToken).toHaveBeenCalledWith(res, 'new-refresh');
      expect(result).toEqual({ accessToken: 'new-access' });
    });
  });

  describe('logoutAllDevices', () => {
    it('should clear cookie and call authService.logoutAllDevices with user id', async () => {
      const res = createResMock();
      authServiceMock.logoutAllDevices.mockResolvedValue(undefined);

      const result = await controller.logoutAllDevices(res, mockUser);

      expect(cookieServiceMock.clearRefreshToken).toHaveBeenCalledWith(res);
      expect(authServiceMock.logoutAllDevices).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ message: 'Successfully logged out from all devices.' });
    });
  });

  describe('getStatus', () => {
    it('should return the mapped user object', () => {
      const mappedUser = { id: 'user-1', email: 'user-1@example.com' };
      authMapperMock.toStatusResponse.mockReturnValue(mappedUser);

      const result = controller.getStatus(mockUser);

      expect(authMapperMock.toStatusResponse).toHaveBeenCalledWith(mockUser);
      expect(result).toEqual(mappedUser);
    });
  });
});
