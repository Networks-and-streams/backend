import { OAuthProvider } from '@/generated/prisma/client';

export interface NormalizedOAuthProfile {
  provider: OAuthProvider;
  providerAccountId: string;
  email: string;
  /** Google confirmed the user owns `email`. */
  emailVerified: boolean;
  firstName: string | null;
  lastName: string | null;
  avatar: string | null;
}
