import {Injectable} from '@nestjs/common';
import {JwtService} from '@nestjs/jwt';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository} from 'typeorm';
import {User} from '../database/entities';
import {hashPassword} from './password';
import {RegisterUserDto} from './users.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jwt: JwtService,
  ) {}

  async register(input: RegisterUserDto) {
    const user = this.users.create({
      username: input.username,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      bio: null,
      image: null,
    });
    return this.present(await this.users.save(user));
  }

  async present(user: User) {
    return {user: {
      email: user.email,
      token: await this.jwt.signAsync({sub: user.id}),
      username: user.username,
      bio: user.bio,
      image: user.image,
    }};
  }
}
