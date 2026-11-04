import {Body, Controller, HttpCode, Post} from '@nestjs/common';
import {ApiTags} from '@nestjs/swagger';
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
}
