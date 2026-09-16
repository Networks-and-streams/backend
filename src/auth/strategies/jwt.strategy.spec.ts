import { Test, TestingModule } from '@nestjs/testing';

import { JwtStrategy } from './jwt.strategy';
import { AuthService } from '../auth.service';
import jwtConfig from '@/config/loaders/jwt.config';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

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
        JwtStrategy,
        { provide: AuthService, useValue: authServiceMock },
        { provide: jwtConfig.KEY, useValue: jwtConfigMock },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  describe('validate', () => {
    it('should return the payload directly', () => {
      const payload = { id: 'user-1', email: 'test@example.com', sid: 'session-1' };

      const result = strategy.validate(payload);

      expect(result).toBe(payload);
    });

    it('should return payload with different user data', () => {
      const payload = { id: 'user-2', email: 'other@example.com', sid: 'session-2' };

      const result = strategy.validate(payload);

      expect(result).toEqual({ id: 'user-2', email: 'other@example.com', sid: 'session-2' });
    });
  });
});
