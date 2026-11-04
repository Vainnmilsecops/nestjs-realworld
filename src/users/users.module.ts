import {Module} from '@nestjs/common';
import {UsersController} from './users.controller';
import {UsersService} from './users.service';
import {ProfilesController} from './profiles.controller';
import {ProfilesService} from './profiles.service';

@Module({controllers: [UsersController, ProfilesController], providers: [UsersService, ProfilesService]})
export class UsersModule {}
