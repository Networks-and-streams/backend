import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';

import { JwtRefreshStrategy } from './jwt-refresh.strategy';
import { AuthService } from '../auth.service';
import jwtConfig from '@/config/loaders/jwt.config';

describe('JwtRefreshStrategy', () => {
  let strategy: JwtRefreshStrategy;

  const authServiceMock = {
    validateUser: jest.fn(),
  };

  const jwtConfigMock = {
    secret: 'test-jwt-secret',
    accessTokenTtl: '15m',
    refreshSecret: 'test-refresh-secret',
    refreshTokenTtl: '7d',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtRefreshStrategy,
        { provide: AuthService, useValue: authServiceMock },
        { provide: jwtConfig.KEY, useValue: jwtConfigMock },
      ],
    }).compile();

    strategy = module.get<JwtRefreshStrategy>(JwtRefreshStrategy);
  });

  describe('validate', () => {
    it('should return the refresh payload when user exists', async () => {
      const user = { id: 'user-1', email: 'test@example.com' };
      authServiceMock.validateUser.mockResolvedValue(user);

      const payload = { id: 'user-1', sid: 'session-1', jti: 'jti-1' };
      const result = await strategy.validate(payload);

      expect(authServiceMock.validateUser).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(payload);
    });

    it('should throw UnauthorizedException when user does not exist', async () => {
      authServiceMock.validateUser.mockResolvedValue(null);

      const payload = { id: 'nonexistent', sid: 'session-1', jti: 'jti-1' };
      await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);

      expect(authServiceMock.validateUser).toHaveBeenCalledWith('nonexistent');
    });

    it('should propagate exceptions from authService', async () => {
      authServiceMock.validateUser.mockRejectedValue(new Error('DB failure'));

      await expect(strategy.validate({ id: 'user-1', sid: 's', jti: 'j' })).rejects.toThrow('DB failure');
    });
  });
});
