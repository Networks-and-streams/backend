import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionResponseDto } from './dto/subscription-response.dto';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { JwtUser } from '@/common/types/jwt-payload.type';

@ApiTags('Subscriptions')
@ApiBearerAuth('JWT-auth')
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('me')
  @ApiOperation({
    summary: 'Get current user subscription',
    description:
      "Returns the authenticated user's subscription state (status, plan, active/expiry dates). " +
      'The backend is the source of truth for access state; the frontend must not rely on local state.',
  })
  @ApiOkResponse({ type: SubscriptionResponseDto, description: 'Subscription returned successfully' })
  async getMySubscription(@CurrentUser() user: JwtUser): Promise<SubscriptionResponseDto> {
    const subscription = await this.subscriptionsService.findByUserIdOrThrow(user.id);
    return subscription as SubscriptionResponseDto;
  }
}
