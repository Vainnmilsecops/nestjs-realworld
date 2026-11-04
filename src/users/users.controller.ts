import {Body, Controller, Get, HttpCode, Post, UseGuards} from '@nestjs/common';
import {ApiSecurity, ApiTags} from '@nestjs/swagger';
import {AuthGuard, CurrentUser} from '../common/auth';
import {User} from '../database/entities';
import {LoginUserBody, RegisterUserBody} from './users.dto';
import {UsersService} from './users.service';

@ApiTags('users')
@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Post('users')
  register(@Body() body: RegisterUserBody) {
    return this.users.register(body.user);
  }

  @Post('users/login')
  @HttpCode(200)
  login(@Body() body: LoginUserBody) {
    return this.users.login(body.user);
  }

  @Get('user')
  @UseGuards(AuthGuard)
  @ApiSecurity('token')
  current(@CurrentUser() user: User) {
    return this.users.present(user);
  }
}
