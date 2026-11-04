import {Body, Controller, Get, HttpCode, Post, Put, UseGuards} from '@nestjs/common';
import {ApiSecurity, ApiTags} from '@nestjs/swagger';
import {AuthGuard, CurrentUser} from '../common/auth';
import {User} from '../database/entities';
import {LoginUserBody, RegisterUserBody, UpdateUserBody} from './users.dto';
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

  @Put('user')
  @UseGuards(AuthGuard)
  @ApiSecurity('token')
  update(@CurrentUser() user: User, @Body() body: UpdateUserBody) {
    return this.users.update(user, body.user);
  }
}
