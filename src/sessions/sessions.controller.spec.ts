import { Test, TestingModule } from '@nestjs/testing';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { SessionsMapper } from '@/sessions/sessions.mapper';

describe('SessionsController', () => {
  let controller: SessionsController;
  let sessionsService: jest.Mocked<SessionsService>;

  const mockSessionsService = {
    findAllUserSessions: jest.fn(),
    terminateSession: jest.fn(),
    removeOtherUserSessions: jest.fn(),
  };

  const mockSessionsMapper = {
    toResponses: jest.fn(),
    toResponse: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SessionsController],
      providers: [
        { provide: SessionsService, useValue: mockSessionsService },
        { provide: SessionsMapper, useValue: mockSessionsMapper },
      ],
    }).compile();

    controller = module.get<SessionsController>(SessionsController);
    sessionsService = module.get(SessionsService);
    jest.clearAllMocks();
  });

  describe('getMySessions', () => {
    it('calls sessionsService.findAllUserSessions and returns mapped result', async () => {
      const user = { id: 'user-1', email: 'user@example.com', sid: 'sid-1' };
      const sessions = [{ id: '1', ip: '127.0.0.1', userAgent: 'agent', expiresAt: new Date(), createdAt: new Date() }];
      const mapped = [
        {
          id: '1',
          ip: '127.0.0.1',
          userAgent: 'agent',
          expiresAt: sessions[0].expiresAt,
          createdAt: sessions[0].createdAt,
        },
      ];
      mockSessionsService.findAllUserSessions.mockResolvedValue(sessions);
      mockSessionsMapper.toResponses.mockReturnValue(mapped);

      const result = await controller.getMySessions(user);

      expect(sessionsService.findAllUserSessions).toHaveBeenCalledWith('user-1');
      expect(mockSessionsMapper.toResponses).toHaveBeenCalledWith(sessions);
      expect(result).toEqual(mapped);
    });
  });

  describe('terminateSession', () => {
    it('calls sessionsService.terminateSession with session id and user id', async () => {
      const user = { id: 'user-1', email: 'user@example.com', sid: 'sid-1' };
      mockSessionsService.terminateSession.mockResolvedValue(undefined);

      const result = await controller.terminateSession(user, 'session-1');

      expect(sessionsService.terminateSession).toHaveBeenCalledWith('session-1', 'user-1');
      expect(result).toBeUndefined();
    });
  });

  describe('terminateOtherSessions', () => {
    it('calls sessionsService.removeOtherUserSessions with user id and refresh token', async () => {
      const user = { id: 'user-1', email: 'user@example.com', sid: 'sid-1' };
      const refreshToken = 'refresh-token-value';
      mockSessionsService.removeOtherUserSessions.mockResolvedValue(undefined);

      const result = await controller.terminateOtherSessions(user, refreshToken);

      expect(sessionsService.removeOtherUserSessions).toHaveBeenCalledWith('user-1', refreshToken);
      expect(result).toBeUndefined();
    });
  });
});
