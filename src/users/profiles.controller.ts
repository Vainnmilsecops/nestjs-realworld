import {Controller, Get, Param, UseGuards} from '@nestjs/common';
import {ApiTags} from '@nestjs/swagger';
import {CurrentUser, OptionalAuthGuard} from '../common/auth';
import {User} from '../database/entities';
import {ProfilesService} from './profiles.service';

@ApiTags('profiles')
@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @Get(':username')
  @UseGuards(OptionalAuthGuard)
  get(@Param('username') username: string, @CurrentUser() viewer?: User) {
    return this.profiles.get(username, viewer?.id);
  }
}
