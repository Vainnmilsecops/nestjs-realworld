import {Body, Controller, Post} from '@nestjs/common';
import {ApiTags} from '@nestjs/swagger';
import {RegisterUserBody} from './users.dto';
import {UsersService} from './users.service';

@ApiTags('users')
@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Post('users')
  register(@Body() body: RegisterUserBody) {
    return this.users.register(body.user);
  }
}
