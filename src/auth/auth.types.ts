import {Request} from 'express';
import {User} from '../users/entities/user.entity';

export interface TokenClaims {
  sub: string;
  jti: string;
  exp: number;
  iat: number;
  iss: string;
  aud: string;
}

export interface AuthenticatedRequest extends Request {
  user: User;
  authClaims: TokenClaims;
  authToken: string;
}

export const JWT_ISSUER = 'realworld-training';
export const JWT_AUDIENCE = 'realworld-api';
