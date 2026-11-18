import {CanActivate, ExecutionContext, Injectable} from '@nestjs/common';
import type {Request} from 'express';
import {JwtAuthGuard} from './jwt-auth.guard';

@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(private readonly jwtAuth: JwtAuthGuard) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    if (request.headers.authorization === undefined) return true;
    return this.jwtAuth.canActivate(context);
  }
}
