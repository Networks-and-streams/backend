import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import cryptoConfig from '@/config/loaders/crypto.config';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

/**
 * Encrypts/decrypts sensitive credentials at rest (e.g. OAuth refresh tokens)
 * using AES-256-GCM. Payload format: `base64(iv):base64(authTag):base64(ciphertext)`.
 */
@Injectable()
export class EncryptionService {
  constructor(@Inject(cryptoConfig.KEY) private readonly config: ConfigType<typeof cryptoConfig>) {}

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.getKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

    return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString('base64')).join(':');
  }

  decrypt(payload: string): string {
    const [iv, authTag, ciphertext] = payload.split(':').map((part) => Buffer.from(part, 'base64'));

    if (!iv?.length || !authTag?.length || !ciphertext?.length) {
      throw new Error('Malformed encrypted payload');
    }

    const decipher = createDecipheriv(ALGORITHM, this.getKey(), iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  }

  private getKey(): Buffer {
    const key = Buffer.from(this.config.credentialsKey, 'hex');

    if (key.length !== KEY_LENGTH) {
      throw new Error(`CREDENTIALS_ENCRYPTION_KEY must be ${KEY_LENGTH} bytes of hex (${KEY_LENGTH * 2} chars)`);
    }

    return key;
  }
}
