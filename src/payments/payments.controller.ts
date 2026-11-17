import { Body, Controller, Get, HttpCode, Param, Post, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { PaymentsService } from './payments.service';
import { PaymentsMapper } from './payments.mapper';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { GooglePayDto } from './dto/google-pay.dto';
import { PaymentConfigResponseDto } from './dto/payment-config-response.dto';
import { PaymentResponseDto } from './dto/payment-response.dto';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';
import type { JwtUser } from '@/common/types/jwt-payload.type';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly paymentsMapper: PaymentsMapper,
  ) {}

  @Post()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create a payment order',
    description:
      'Creates a PENDING payment for the authenticated user. ' +
      'The amount and currency are determined server-side from the requested plan — ' +
      'client-provided amounts are never accepted. ' +
      'Repeated requests return the existing PENDING payment (idempotent).',
  })
  @ApiBody({ type: CreatePaymentDto })
  @ApiCreatedResponse({ type: PaymentResponseDto, description: 'Payment created successfully' })
  @ApiConflictResponse({ description: 'An active subscription already exists or payment cannot be created' })
  async createPayment(@CurrentUser() user: JwtUser, @Body() dto: CreatePaymentDto): Promise<PaymentResponseDto> {
    const payment = await this.paymentsService.createPayment(user.id, dto);
    return this.paymentsMapper.toResponse(payment);
  }

  // Literal path — must stay declared BEFORE `@Get(':id')` so it is not
  // captured as a payment id (Nest registers routes in declaration order).
  @Public()
  @Get('config')
  @ApiOperation({
    summary: 'Payment configuration for the client',
    description:
      'Tells the client how payments behave in this deployment (e.g. PAYMENTS_TEST_MODE on the ' +
      'desktop build), so the UI can offer the matching payment flow. Public: capability flags only, no secrets.',
  })
  @ApiOkResponse({ type: PaymentConfigResponseDto, description: 'Payment configuration' })
  getPaymentConfig(): PaymentConfigResponseDto {
    return this.paymentsService.getClientConfig();
  }

  @Get(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get payment by ID',
    description:
      'Returns the payment if it belongs to the authenticated user. ' +
      'Payments belonging to other users are indistinguishable from non-existent ones.',
  })
  @ApiParam({ name: 'id', description: 'Internal payment ID' })
  @ApiOkResponse({ type: PaymentResponseDto, description: 'Payment returned successfully' })
  @ApiNotFoundResponse({ description: 'Payment not found' })
  async getPayment(@CurrentUser() user: JwtUser, @Param('id') paymentId: string): Promise<PaymentResponseDto> {
    const payment = await this.paymentsService.getPayment(user.id, paymentId);
    return this.paymentsMapper.toResponse(payment);
  }

  @Post(':id/google-pay')
  // Explicit200: this is an action on an existing payment, not the creation
  // of a resource (Nest would otherwise default POST to 201 — which
  // contradicted the documented ApiOkResponse).
  @HttpCode(200)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Submit a Google Pay token for a payment',
    description:
      'Submits Google Pay tokenization data to the backend for processing via the configured PSP. ' +
      'The backend, not the frontend, determines the final payment result. ' +
      'If the PSP confirms success synchronously, the payment is marked SUCCEEDED and the ' +
      "user's subscription is activated; otherwise the PSP webhook remains the source of truth.",
  })
  @ApiParam({ name: 'id', description: 'Internal payment ID' })
  @ApiBody({ type: GooglePayDto })
  @ApiOkResponse({ type: PaymentResponseDto, description: 'Payment processed' })
  @ApiNotFoundResponse({ description: 'Payment not found' })
  @ApiConflictResponse({ description: 'Payment is already being processed or in a terminal state' })
  async processGooglePay(
    @CurrentUser() user: JwtUser,
    @Param('id') paymentId: string,
    @Body() dto: GooglePayDto,
  ): Promise<PaymentResponseDto> {
    const payment = await this.paymentsService.processGooglePay(user.id, paymentId, dto);
    return this.paymentsMapper.toResponse(payment);
  }

  @Public()
  @Post('webhook')
  @HttpCode(200)
  @ApiOperation({
    summary: 'PSP webhook',
    description:
      'Receives provider webhook deliveries. The signature/authentication is verified before ' +
      'any state change. Idempotent: repeated deliveries of the same event are no-ops. ' +
      'The backend is the source of truth for payment and subscription state.',
  })
  @ApiOkResponse({ description: 'Webhook acknowledged' })
  @ApiUnauthorizedResponse({ description: 'Invalid webhook signature' })
  async webhook(@Req() req: Request & { rawBody?: Buffer }, @Body() _body: unknown) {
    const headers = req.headers as Record<string, string>;
    // Stripe signature verification requires the raw body bytes, not the
    // JSON-parsed object. `StripeWebhookRawBodyMiddleware` captures it.
    return this.paymentsService.handleWebhook(headers, req.rawBody);
  }
}
