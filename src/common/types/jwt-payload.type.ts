export interface JwtUser {
  id: string;
  email: string;
  sid: string;
}

export interface RefreshJwtPayload {
  id: string;
  sid: string;
  jti: string;
}
