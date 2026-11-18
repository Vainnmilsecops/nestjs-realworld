import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import {CurrentUser} from '../auth/current-user.decorator';
import {JwtAuthGuard} from '../auth/jwt-auth.guard';
import {OptionalJwtAuthGuard} from '../auth/optional-jwt-auth.guard';
import type {User} from './entities/user.entity';
import {ProfileResponseDto} from './profiles.dto';
import {ProfilesService} from './profiles.service';

@ApiTags('profiles')
@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @Get(':username')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiSecurity('token')
  @ApiSecurity({})
  @ApiOperation({
    summary: 'Get a public profile with optional following status',
  })
  @ApiOkResponse({type: ProfileResponseDto})
  @ApiNotFoundResponse({description: 'Profile not found'})
  @ApiUnauthorizedResponse({
    description: 'The supplied token is invalid or revoked',
  })
  getProfile(
    @Param('username') username: string,
    @CurrentUser() viewer: User | undefined,
  ): Promise<ProfileResponseDto> {
    return this.profiles.getProfile(username, viewer?.id);
  }

  @Post(':username/follow')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiSecurity('token')
  @ApiOperation({summary: 'Follow a profile'})
  @ApiOkResponse({type: ProfileResponseDto})
  @ApiNotFoundResponse({description: 'Profile not found'})
  @ApiUnauthorizedResponse({description: 'A valid token is required'})
  @ApiUnprocessableEntityResponse({description: 'Cannot follow yourself'})
  follow(
    @Param('username') username: string,
    @CurrentUser() viewer: User,
  ): Promise<ProfileResponseDto> {
    return this.profiles.follow(username, viewer.id);
  }

  @Delete(':username/follow')
  @UseGuards(JwtAuthGuard)
  @ApiSecurity('token')
  @ApiOperation({summary: 'Unfollow a profile'})
  @ApiOkResponse({type: ProfileResponseDto})
  @ApiNotFoundResponse({description: 'Profile not found'})
  @ApiUnauthorizedResponse({description: 'A valid token is required'})
  @ApiUnprocessableEntityResponse({description: 'Cannot unfollow yourself'})
  unfollow(
    @Param('username') username: string,
    @CurrentUser() viewer: User,
  ): Promise<ProfileResponseDto> {
    return this.profiles.unfollow(username, viewer.id);
  }
}
