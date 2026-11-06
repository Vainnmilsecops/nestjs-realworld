import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import {ThrottlerGuard} from '@nestjs/throttler';
import {
  AuthResponseDto,
  LoginUserRequestDto,
  RegisterUserRequestDto,
} from './auth.dto';
import {AuthService} from './auth.service';
import {AuthenticatedRequest} from './auth.types';
import {JwtAuthGuard} from './jwt-auth.guard';

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
