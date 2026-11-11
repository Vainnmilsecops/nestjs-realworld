import {Global, Module} from '@nestjs/common';
import {ConfigModule, ConfigService} from '@nestjs/config';
import {TypeOrmModule} from '@nestjs/typeorm';
import type {Environment} from '../config/environment';
import {User} from '../users/entities/user.entity';
import {databaseOptions} from './database-options';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<Environment>) =>
        databaseOptions(config.getOrThrow('DATABASE_URL', {infer: true})),
    }),
    TypeOrmModule.forFeature([User]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
