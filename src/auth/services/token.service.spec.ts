import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';

import { TokenService } from './token.service';
import jwtConfig from '@/config/loaders/jwt.config';

jest.mock('node:crypto', () => ({
  randomUUID: jest.fn().mockReturnValue('mocked-uuid'),
}));

describe('TokenService', () => {
  let service: TokenService;

  const jwtServiceMock = {
    signAsync: jest.fn(),
  };

  const jwtConfigMock = {
    secret: 'test-secret',
    accessTokenTtl: '15m',
    refreshSecret: 'test-refresh-secret',
    refreshTokenTtl: '7d',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        {
          provide: JwtService,
          useValue: jwtServiceMock,
        },
        {
          provide: jwtConfig.KEY,
          useValue: jwtConfigMock,
        },
      ],
    }).compile();

    service = module.get(TokenService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generate', () => {
    it('should generate access and refresh tokens', async () => {
      jwtServiceMock.signAsync.mockResolvedValueOnce('access-token').mockResolvedValueOnce('refresh-token');

      const result = await service.generate('user-1', 'user@example.com', 'session-1');

      expect(jwtServiceMock.signAsync).toHaveBeenCalledTimes(2);
      expect(jwtServiceMock.signAsync).toHaveBeenNthCalledWith(
        1,
        { id: 'user-1', email: 'user@example.com', sid: 'session-1' },
        {
          secret: 'test-secret',
          expiresIn: '15m',
        },
      );
      expect(jwtServiceMock.signAsync).toHaveBeenNthCalledWith(
        2,
        { id: 'user-1', sid: 'session-1', jti: 'mocked-uuid' },
        {
          secret: 'test-refresh-secret',
          expiresIn: '7d',
        },
      );

      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
    });
  });

  describe('accessToken', () => {
    it('should sign an access token with user id, email, and sid', async () => {
      jwtServiceMock.signAsync.mockResolvedValue('access-token');

      const result = await service.accessToken('user-1', 'user@example.com', 'session-1');

      expect(jwtServiceMock.signAsync).toHaveBeenCalledWith(
        { id: 'user-1', email: 'user@example.com', sid: 'session-1' },
        {
          secret: 'test-secret',
          expiresIn: '15m',
        },
      );
      expect(result).toBe('access-token');
    });
  });

  describe('refreshToken', () => {
    it('should sign a refresh token with id, sid, and jti', async () => {
      jwtServiceMock.signAsync.mockResolvedValue('refresh-token');

      const result = await service.refreshToken('user-1', 'session-1');

      expect(jwtServiceMock.signAsync).toHaveBeenCalledWith(
        { id: 'user-1', sid: 'session-1', jti: 'mocked-uuid' },
        {
          secret: 'test-refresh-secret',
          expiresIn: '7d',
        },
      );
      expect(result).toBe('refresh-token');
    });
  });
});
