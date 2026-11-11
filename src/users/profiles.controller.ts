import {Controller, Get, Header, Param, UseGuards} from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {CurrentUser} from '../auth/current-user.decorator';
import {OptionalJwtAuthGuard} from '../auth/optional-jwt-auth.guard';
import type {User} from './entities/user.entity';
import {ProfileResponseDto} from './profiles.dto';
import {ProfilesService} from './profiles.service';

@ApiTags('profiles')
@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @Get(':username')
  @Header('Cache-Control', 'no-store')
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
}
