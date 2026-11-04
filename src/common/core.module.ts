import {Global, Module} from '@nestjs/common';
import {ConfigModule, ConfigService} from '@nestjs/config';
import {JwtModule} from '@nestjs/jwt';
import {TypeOrmModule} from '@nestjs/typeorm';
import {APP_GUARD} from '@nestjs/core';
import {ThrottlerGuard, ThrottlerModule} from '@nestjs/throttler';
import {entities} from '../database/entities';
import {databaseOptions} from '../database/data-source';
import {AuthGuard, OptionalAuthGuard} from './auth';
import {ProfilePresenter} from './profile.presenter';

@Global()
@Module({
  imports: [
    ThrottlerModule.forRoot([{ttl: 60000, limit: 100}]),
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config: Record<string, unknown>) => {
        if (typeof config.DATABASE_URL !== 'string' || !/^postgres(?:ql)?:\/\//.test(config.DATABASE_URL)) {
          throw new Error('DATABASE_URL must be a PostgreSQL connection URL');
        }
        if (typeof config.JWT_SECRET !== 'string' || config.JWT_SECRET.length < 32) {
          throw new Error('JWT_SECRET must contain at least 32 characters; run npm run setup');
        }
        const ttl = Number(config.JWT_EXPIRES_IN_SECONDS ?? 604800);
        if (!Number.isSafeInteger(ttl) || ttl < 60) throw new Error('Invalid JWT expiry');
        return {...config, JWT_EXPIRES_IN_SECONDS: ttl};
      },
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => databaseOptions(config.getOrThrow<string>('DATABASE_URL')),
    }),
    TypeOrmModule.forFeature(entities),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {expiresIn: config.getOrThrow<number>('JWT_EXPIRES_IN_SECONDS'), algorithm: 'HS256'},
        verifyOptions: {algorithms: ['HS256']},
      }),
    }),
  ],
  providers: [AuthGuard, OptionalAuthGuard, ProfilePresenter,
    {provide: APP_GUARD, useClass: ThrottlerGuard}],
  exports: [TypeOrmModule, JwtModule, AuthGuard, OptionalAuthGuard, ProfilePresenter],
})
export class CoreModule {}
