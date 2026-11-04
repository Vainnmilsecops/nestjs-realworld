import {
  CanActivate, createParamDecorator, ExecutionContext, Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {JwtService} from '@nestjs/jwt';
import {InjectRepository} from '@nestjs/typeorm';
import {Request} from 'express';
import {Repository} from 'typeorm';
import {User} from '../database/entities';

export interface AuthRequest extends Request { user?: User; }

@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const header = request.headers.authorization;
    if (!header) return true;
    const match = /^(?:Token|Bearer) (\S+)$/.exec(header);
    if (!match?.[1]) throw new UnauthorizedException('Invalid authorization header');
    try {
      const payload = await this.jwt.verifyAsync<{sub: number}>(match[1]);
      if (!Number.isSafeInteger(payload.sub) || payload.sub <= 0) {
        throw new Error('Invalid token subject');
      }
      const user = await this.users.findOneBy({id: payload.sub});
      if (!user) throw new UnauthorizedException('User no longer exists');
      request.user = user;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    return true;
  }
}

@Injectable()
export class AuthGuard extends OptionalAuthGuard {
  override async canActivate(context: ExecutionContext): Promise<boolean> {
    await super.canActivate(context);
    if (!context.switchToHttp().getRequest<AuthRequest>().user) {
      throw new UnauthorizedException('Authentication required');
    }
    return true;
  }
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): User | undefined =>
    context.switchToHttp().getRequest<AuthRequest>().user,
);
