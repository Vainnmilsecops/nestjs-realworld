import {Controller, Delete, Get, HttpCode, Param, Post, UseGuards} from '@nestjs/common';
import {ApiSecurity, ApiTags} from '@nestjs/swagger';
import {AuthGuard, CurrentUser, OptionalAuthGuard} from '../common/auth';
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

  @Post(':username/follow')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  @ApiSecurity('token')
  follow(@Param('username') username: string, @CurrentUser() viewer: User) {
    return this.profiles.follow(username, viewer.id);
  }

  @Delete(':username/follow')
  @UseGuards(AuthGuard)
  @ApiSecurity('token')
  unfollow(@Param('username') username: string, @CurrentUser() viewer: User) {
    return this.profiles.unfollow(username, viewer.id);
  }
}
