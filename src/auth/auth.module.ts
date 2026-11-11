import {Module} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {JwtModule} from '@nestjs/jwt';
import {ThrottlerModule} from '@nestjs/throttler';
import type {Environment} from '../config/environment';
import {RedisModule} from '../redis/redis.module';
import {AuthController} from './auth.controller';
import {AuthService} from './auth.service';
import {JWT_AUDIENCE, JWT_ISSUER} from './auth.types';
import {JwtAuthGuard} from './jwt-auth.guard';

const AUTH_RATE_WINDOW_MS = 60_000;

@Module({
  imports: [
    RedisModule,
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Environment>) => [
        {
          ttl: AUTH_RATE_WINDOW_MS,
          limit: config.getOrThrow('AUTH_RATE_LIMIT', {infer: true}),
        },
      ],
    }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Environment>) => ({
        secret: config.getOrThrow('JWT_SECRET', {infer: true}),
        signOptions: {
          algorithm: 'HS256',
          expiresIn: config.getOrThrow('JWT_EXPIRES_IN_SECONDS', {infer: true}),
          issuer: JWT_ISSUER,
          audience: JWT_AUDIENCE,
        },
        verifyOptions: {
          algorithms: ['HS256'],
          issuer: JWT_ISSUER,
          audience: JWT_AUDIENCE,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
