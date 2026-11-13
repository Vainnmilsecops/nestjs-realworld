import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Post,
  Put,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {FileInterceptor} from '@nestjs/platform-express';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import {ThrottlerGuard} from '@nestjs/throttler';
import {MAX_AVATAR_FILE_SIZE} from '../attachments/attachments.service';
import type {User} from '../users/entities/user.entity';
import {
  AuthResponseDto,
  LoginUserRequestDto,
  RegisterUserRequestDto,
  UpdateUserRequestDto,
} from './auth.dto';
import {AuthService} from './auth.service';
import {AuthenticatedRequest} from './auth.types';
import {CurrentUser} from './current-user.decorator';
import {JwtAuthGuard} from './jwt-auth.guard';
import {UpdateUserBodyInterceptor} from './update-user-body.interceptor';

@ApiTags('authentication')
@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('users')
  @Header('Cache-Control', 'no-store')
  @UseGuards(ThrottlerGuard)
  @ApiOperation({summary: 'Register an account'})
  @ApiCreatedResponse({type: AuthResponseDto})
  @ApiUnprocessableEntityResponse({
    description: 'Invalid input or duplicate username/email',
  })
  register(@Body() request: RegisterUserRequestDto): Promise<AuthResponseDto> {
    return this.auth.register(request.user);
  }

  @Post('users/login')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @UseGuards(ThrottlerGuard)
  @ApiOperation({summary: 'Log in and create a separate JWT session'})
  @ApiOkResponse({type: AuthResponseDto})
  @ApiUnauthorizedResponse({description: 'Invalid email or password'})
  login(@Body() request: LoginUserRequestDto): Promise<AuthResponseDto> {
    return this.auth.login(request.user);
  }

  @Get('user')
  @Header('Cache-Control', 'no-store')
  @UseGuards(JwtAuthGuard)
  @ApiSecurity('token')
  @ApiOperation({summary: 'Get the current user with the original JWT'})
  @ApiOkResponse({type: AuthResponseDto})
  current(@Req() request: AuthenticatedRequest): AuthResponseDto {
    return this.auth.current(request.user, request.authToken);
  }

  @Put('user')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('avatar', {
      limits: {fileSize: MAX_AVATAR_FILE_SIZE + 1, files: 1, fields: 1},
    }),
    UpdateUserBodyInterceptor,
  )
  @ApiSecurity('token')
  @ApiOperation({summary: 'Update the current user or upload an avatar'})
  @ApiOkResponse({type: AuthResponseDto})
  @ApiUnauthorizedResponse({description: 'Authentication required'})
  @ApiPayloadTooLargeResponse({description: 'Avatar exceeds 2 MiB'})
  @ApiUnprocessableEntityResponse({
    description: 'Invalid input or duplicate username/email',
  })
  update(
    @CurrentUser() user: User,
    @Req() request: AuthenticatedRequest,
    @Body() body: UpdateUserRequestDto,
    @UploadedFile() avatar?: {buffer: Buffer; size: number},
  ): Promise<AuthResponseDto> {
    return this.auth.update(user, request.authToken, body.user, avatar);
  }

  @Post('users/logout')
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  @UseGuards(JwtAuthGuard)
  @ApiSecurity('token')
  @ApiOperation({summary: 'Revoke only the current JWT until its expiration'})
  @ApiNoContentResponse({description: 'Current JWT revoked'})
  async logout(@Req() request: AuthenticatedRequest): Promise<void> {
    await this.auth.logout(request.authClaims);
  }
}
