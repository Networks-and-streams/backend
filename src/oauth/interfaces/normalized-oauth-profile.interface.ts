import { OAuthProvider } from '@/generated/prisma/client';

export interface NormalizedOAuthProfile {
  provider: OAuthProvider;
  providerAccountId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatar: string | null;
}
