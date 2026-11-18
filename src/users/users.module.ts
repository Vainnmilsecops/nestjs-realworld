import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {AuthModule} from '../auth/auth.module';
import {OptionalJwtAuthGuard} from '../auth/optional-jwt-auth.guard';
import {Follow} from './entities/follow.entity';
import {ProfilesController} from './profiles.controller';
import {ProfilesService} from './profiles.service';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([Follow])],
  controllers: [ProfilesController],
  providers: [ProfilesService, OptionalJwtAuthGuard],
})
export class UsersModule {}
