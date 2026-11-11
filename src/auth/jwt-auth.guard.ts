import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {JwtService} from '@nestjs/jwt';
import {InjectRepository} from '@nestjs/typeorm';
import {isUUID} from 'class-validator';
import {I18nService} from 'nestjs-i18n';
import {Repository} from 'typeorm';
import {TokenBlacklistService} from '../redis/token-blacklist.service';
import {User} from '../users/entities/user.entity';
import {AuthenticatedRequest, TokenClaims} from './auth.types';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly blacklist: TokenBlacklistService,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly translations: I18nService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const match = /^(?:Token|Bearer) (\S+)$/.exec(
      request.headers.authorization ?? '',
    );
    const token = match?.[1];
    if (!token) {
      throw new UnauthorizedException(
        this.translations.t('auth.AUTHENTICATION_REQUIRED'),
      );
    }
    let claims: Record<string, unknown>;
    try {
      claims = await this.jwt.verifyAsync<Record<string, unknown>>(token);
    } catch {
      throw new UnauthorizedException(
        this.translations.t('auth.INVALID_OR_EXPIRED_TOKEN'),
      );
    }
    if (!this.hasValidClaims(claims)) {
      throw new UnauthorizedException(
        this.translations.t('auth.INVALID_TOKEN_CLAIMS'),
      );
    }
    if (await this.blacklist.isRevoked(claims.jti)) {
      throw new UnauthorizedException(
        this.translations.t('auth.REVOKED_TOKEN'),
      );
    }
    const user = await this.users.findOneBy({id: claims.sub});
    if (!user) {
      throw new UnauthorizedException(
        this.translations.t('auth.USER_NOT_FOUND'),
      );
    }
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
      typeof payload.iss === 'string' &&
      typeof payload.aud === 'string'
    );
  }
}
