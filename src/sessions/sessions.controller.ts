import { Controller, Get, Delete, Param, HttpCode } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiParam,
  ApiNotFoundResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';

import { SessionsService } from './sessions.service';
import { SessionsMapper } from '@/sessions/sessions.mapper';
import { SessionResponseDto } from './dto/session-response.dto';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { JwtUser } from '@/common/types/jwt-payload.type';
import { RefreshToken } from './decorators/refresh-token.decorator';

@ApiTags('Auth / Active Devices')
@ApiBearerAuth('JWT-auth')
@Controller('sessions')
export class SessionsController {
  constructor(
    private readonly sessionsService: SessionsService,
    private readonly sessionsMapper: SessionsMapper,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Get all active sessions for current user',
    description:
      'Retrieves a list of all active sessions belonging to the authenticated user. ' +
      'Each session includes metadata such as IP address, user agent, and creation date. ' +
      'Requires a valid JWT access token.',
  })
  @ApiOkResponse({ type: [SessionResponseDto], description: 'List of active sessions returned successfully' })
  async getMySessions(@CurrentUser() user: JwtUser) {
    const sessions = await this.sessionsService.findAllUserSessions(user.id);
    return this.sessionsMapper.toResponses(sessions);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Terminate a specific session by ID',
    description:
      'Terminates a specific active session identified by its ID. ' +
      'Only sessions belonging to the authenticated user can be terminated. ' +
      'Returns no content on success. Requires a valid JWT access token.',
  })
  @ApiParam({ name: 'id', description: 'The unique identifier of the session to terminate' })
  @ApiOkResponse({ description: 'Session terminated successfully' })
  @ApiForbiddenResponse({ description: 'The authenticated user does not own this session' })
  @ApiNotFoundResponse({ description: 'Session with the specified ID was not found' })
  terminateSession(@CurrentUser() user: JwtUser, @Param('id') sessionId: string) {
    return this.sessionsService.terminateSession(sessionId, user.id);
  }

  @Delete('except/current')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Terminate all sessions except the current one',
    description:
      'Terminates all active sessions for the authenticated user except the current session. ' +
      'The current session is identified by the provided refresh token. ' +
      'Returns no content on success. Requires a valid JWT access token.',
  })
  @ApiOkResponse({ description: 'All other sessions terminated successfully' })
  terminateOtherSessions(@CurrentUser() user: JwtUser, @RefreshToken() refreshToken: string) {
    return this.sessionsService.removeOtherUserSessions(user.id, refreshToken);
  }
}
