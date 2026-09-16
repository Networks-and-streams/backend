import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';

import { LocalStrategy } from './local.strategy';
import { AuthService } from '../auth.service';

describe('LocalStrategy', () => {
  let strategy: LocalStrategy;

  const authServiceMock = {
    validateCredentials: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [LocalStrategy, { provide: AuthService, useValue: authServiceMock }],
    }).compile();

    strategy = module.get<LocalStrategy>(LocalStrategy);
  });

  describe('validate', () => {
    it('should return user when credentials are valid', async () => {
      const user = { id: 'user-1', email: 'test@example.com' };
      authServiceMock.validateCredentials.mockResolvedValue(user);

      const result = await strategy.validate('test@example.com', 'password123');

      expect(authServiceMock.validateCredentials).toHaveBeenCalledWith('test@example.com', 'password123');
      expect(result).toBe(user);
    });

    it('should throw UnauthorizedException when credentials are invalid', async () => {
      authServiceMock.validateCredentials.mockResolvedValue(null);

      await expect(strategy.validate('wrong@example.com', 'bad')).rejects.toThrow(UnauthorizedException);

      expect(authServiceMock.validateCredentials).toHaveBeenCalledWith('wrong@example.com', 'bad');
    });

    it('should throw UnauthorizedException when user has no password', async () => {
      authServiceMock.validateCredentials.mockResolvedValue(null);

      await expect(strategy.validate('no-pass@example.com', 'any')).rejects.toThrow(UnauthorizedException);
    });

    it('should propagate exceptions from authService', async () => {
      authServiceMock.validateCredentials.mockRejectedValue(new Error('Database error'));

      await expect(strategy.validate('a@b.com', 'pw')).rejects.toThrow('Database error');
    });
  });
});
