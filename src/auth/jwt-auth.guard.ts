import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {JwtService} from '@nestjs/jwt';
import {InjectRepository} from '@nestjs/typeorm';
import {isUUID} from 'class-validator';
import {Repository} from 'typeorm';
import {TokenBlacklistService} from '../redis/token-blacklist.service';
import {User} from '../users/entities/user.entity';
import {
  AuthenticatedRequest,
  JWT_AUDIENCE,
  JWT_ISSUER,
  TokenClaims,
} from './auth.types';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly blacklist: TokenBlacklistService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const match = /^(?:Token|Bearer) (\S+)$/.exec(
      request.headers.authorization ?? '',
    );
    const token = match?.[1];
    if (!token) throw new UnauthorizedException('Authentication required');
    let claims: TokenClaims;
    try {
      const payload = await this.jwt.verifyAsync<Record<string, unknown>>(
        token,
        {
          algorithms: ['HS256'],
          issuer: JWT_ISSUER,
          audience: JWT_AUDIENCE,
        },
      );
      if (!this.hasValidClaims(payload)) {
        throw new UnauthorizedException('Invalid token claims');
      }
      claims = payload;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    if (await this.blacklist.isRevoked(claims.jti)) {
      throw new UnauthorizedException('Token has been revoked');
    }
    const user = await this.users.findOneBy({id: claims.sub});
    if (!user) throw new UnauthorizedException('User no longer exists');
    request.user = user;
    request.authClaims = claims;
    request.authToken = token;
    return true;
  }

  private hasValidClaims(
    payload: Record<string, unknown>,
  ): payload is TokenClaims & Record<string, unknown> {
    const now = Math.floor(Date.now() / 1000);
    return (
      typeof payload.sub === 'string' &&
      isUUID(payload.sub) &&
      typeof payload.jti === 'string' &&
      isUUID(payload.jti, '4') &&
      typeof payload.exp === 'number' &&
      Number.isSafeInteger(payload.exp) &&
      payload.exp > now &&
      typeof payload.iat === 'number' &&
      Number.isSafeInteger(payload.iat) &&
      payload.iat >= 0 &&
      payload.iat <= now &&
      payload.iss === JWT_ISSUER &&
      payload.aud === JWT_AUDIENCE
    );
  }
}
