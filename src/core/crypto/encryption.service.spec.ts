import { Test, TestingModule } from '@nestjs/testing';
import cryptoConfig from '@/config/loaders/crypto.config';
import { EncryptionService } from './encryption.service';

const KEY = 'a'.repeat(64);

describe('EncryptionService', () => {
  let service: EncryptionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EncryptionService,
        {
          provide: cryptoConfig.KEY,
          useValue: { credentialsKey: KEY },
        },
      ],
    }).compile();

    service = module.get<EncryptionService>(EncryptionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('encrypt/decrypt', () => {
    it('should round-trip a plaintext value', () => {
      const encrypted = service.encrypt('refresh-token-secret');

      expect(encrypted).not.toContain('refresh-token-secret');
      expect(service.decrypt(encrypted)).toBe('refresh-token-secret');
    });

    it('should produce different ciphertexts for the same plaintext (random IV)', () => {
      const first = service.encrypt('same-value');
      const second = service.encrypt('same-value');

      expect(first).not.toBe(second);
      expect(service.decrypt(first)).toBe('same-value');
      expect(service.decrypt(second)).toBe('same-value');
    });
  });

  describe('decrypt', () => {
    it('should reject a tampered payload', () => {
      const encrypted = service.encrypt('refresh-token-secret');
      const [iv, tag] = encrypted.split(':');
      const tampered = [iv, tag, Buffer.from('evil').toString('base64')].join(':');

      expect(() => service.decrypt(tampered)).toThrow();
      expect(() => service.decrypt(encrypted)).not.toThrow();
    });

    it('should reject a malformed payload', () => {
      expect(() => service.decrypt('not-an-encrypted-payload')).toThrow('Malformed encrypted payload');
    });
  });
});
