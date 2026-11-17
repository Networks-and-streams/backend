import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '@/common/decorators/public.decorator';

/**
 * Liveness probe used by the desktop shell (Electron) and by ops tooling to
 * know when the HTTP server is ready to accept traffic.
 *
 * - `@Public()` so the global JwtGuard does not require a token.
 * - `@SkipThrottle()` because the desktop polls this endpoint during startup;
 *   without it the poll would trip the global 100 req/min IP throttle.
 */
@ApiTags('Health')
@Controller()
export class HealthController {
  @Public()
  @SkipThrottle()
  @Get('health')
  @ApiOperation({
    summary: 'Liveness probe',
    description: 'Returns 200 as soon as the HTTP server is up. No auth required.',
  })
  @ApiOkResponse({ description: 'Service is alive' })
  getHealth(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
