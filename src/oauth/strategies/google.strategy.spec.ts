import { Test, TestingModule } from '@nestjs/testing';
import { OAuthProvider } from '@/generated/prisma/client';

import { GoogleStrategy } from './google.strategy';
import googleConfig from '@/config/loaders/google.config';

describe('GoogleStrategy', () => {
  let strategy: GoogleStrategy;

  const googleConfigMock = {
    clientId: 'google-client-id',
    clientSecret: 'google-client-secret',
    callbackUrl: 'http://localhost:3000/oauth/google/callback',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GoogleStrategy, { provide: googleConfig.KEY, useValue: googleConfigMock }],
    }).compile();

    strategy = module.get<GoogleStrategy>(GoogleStrategy);
  });

  describe('validate', () => {
    it('should normalize a full Google profile into NormalizedOAuthProfile', async () => {
      const googleProfile = {
        id: 'google-uid-123',
        emails: [{ value: 'user@gmail.com', type: 'account' }],
        name: { givenName: 'John', familyName: 'Doe', displayName: 'John Doe' },
        photos: [{ value: 'https://lh3.googleusercontent.com/photo.jpg' }],
        provider: 'google' as const,
        displayName: 'John Doe',
        profileUrl: '',
        _raw: '',
        _json: {},
      };

      const result = await strategy.validate('access-token', 'refresh-token', googleProfile as never);

      expect(result).toEqual({
        provider: OAuthProvider.GOOGLE,
        providerAccountId: 'google-uid-123',
        email: 'user@gmail.com',
        firstName: 'John',
        lastName: 'Doe',
        avatar: 'https://lh3.googleusercontent.com/photo.jpg',
      });
    });

    it('should handle profile with missing emails by returning empty string', async () => {
      const googleProfile = {
        id: 'uid-no-email',
        emails: undefined,
        name: { givenName: 'Jane', familyName: 'Smith' },
        photos: [],
        provider: 'google' as const,
        displayName: 'Jane Smith',
        profileUrl: '',
        _raw: '',
        _json: {},
      };

      const result = await strategy.validate('at', 'rt', googleProfile as never);

      expect(result.email).toBe('');
    });

    it('should handle profile with missing name fields by returning null', async () => {
      const googleProfile = {
        id: 'uid-no-name',
        emails: [{ value: 'x@test.com' }],
        name: undefined,
        photos: [],
        provider: 'google' as const,
        displayName: '',
        profileUrl: '',
        _raw: '',
        _json: {},
      };

      const result = await strategy.validate('at', 'rt', googleProfile as never);

      expect(result.firstName).toBeNull();
      expect(result.lastName).toBeNull();
    });

    it('should handle profile with missing photos by returning null avatar', async () => {
      const googleProfile = {
        id: 'uid-no-photo',
        emails: [{ value: 'x@test.com' }],
        name: { givenName: 'A', familyName: 'B' },
        photos: undefined,
        provider: 'google' as const,
        displayName: '',
        profileUrl: '',
        _raw: '',
        _json: {},
      };

      const result = await strategy.validate('at', 'rt', googleProfile as never);

      expect(result.avatar).toBeNull();
    });

    it('should handle empty name object with givenName/familyName as undefined', async () => {
      const googleProfile = {
        id: 'uid-empty-name',
        emails: [{ value: 'x@test.com' }],
        name: { givenName: undefined, familyName: undefined },
        photos: [],
        provider: 'google' as const,
        displayName: '',
        profileUrl: '',
        _raw: '',
        _json: {},
      };

      const result = await strategy.validate('at', 'rt', googleProfile as never);

      expect(result.firstName).toBeNull();
      expect(result.lastName).toBeNull();
    });
  });
});
