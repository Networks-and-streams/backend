import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsObject } from 'class-validator';

/**
 * Google Pay payment-method payload.
 *
 * This DTO lives at the boundary between the payment domain and the
 * Google Pay payment method. The core payment domain only sees the raw
 * `tokenData` object — it never interprets Google Pay fields itself.
 */
export class GooglePayDto {
  @ApiProperty({
    description:
      'Google Pay tokenization data as returned by the Google Pay API. ' +
      'Contains protocolVersion, signature and signedMessage (provider-specific structure).',
    example: {
      protocolVersion: 'ECv2',
      signature: 'MEUCIQD...',
      signedMessage: '{"encryptedMessage":"...","ephemeralPublicKey":"...","tag":"..."}',
    },
  })
  @IsObject()
  @IsNotEmpty()
  tokenData!: Record<string, unknown>;
}
