import {Module} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {JwtModule} from '@nestjs/jwt';
import {ThrottlerModule} from '@nestjs/throttler';
import {AttachmentsModule} from '../attachments/attachments.module';
import {AttachmentsController} from './attachments.controller';
import {RedisModule} from '../redis/redis.module';
import {AuthController} from './auth.controller';
import {AuthService} from './auth.service';
import {JWT_AUDIENCE, JWT_ISSUER} from './auth.types';
import {JwtAuthGuard} from './jwt-auth.guard';

const AUTH_RATE_WINDOW_MS = 60_000;

@Module({
  imports: [
    AttachmentsModule,
    RedisModule,
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: AUTH_RATE_WINDOW_MS,
          limit: config.getOrThrow<number>('AUTH_RATE_LIMIT'),
        },
      ],
    }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          algorithm: 'HS256',
          expiresIn: config.getOrThrow<number>('JWT_EXPIRES_IN_SECONDS'),
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
  controllers: [AuthController, AttachmentsController],
  providers: [AuthService, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard, JwtModule, RedisModule],
})
export class AuthModule {}
