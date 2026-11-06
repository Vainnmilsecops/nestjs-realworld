import {Injectable, UnauthorizedException} from '@nestjs/common';
import {JwtService} from '@nestjs/jwt';
import {InjectRepository} from '@nestjs/typeorm';
import {randomUUID} from 'node:crypto';
import {Repository} from 'typeorm';
import {TokenBlacklistService} from '../redis/token-blacklist.service';
import {User} from '../users/entities/user.entity';
import {AuthResponseDto, LoginUserDto, RegisterUserDto} from './auth.dto';
import {TokenClaims} from './auth.types';
import {DUMMY_PASSWORD_HASH, hashPassword, verifyPassword} from './password';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jwt: JwtService,
    private readonly blacklist: TokenBlacklistService,
  ) {}

  async register(input: RegisterUserDto): Promise<AuthResponseDto> {
    const user = await this.users.save(
      this.users.create({
        username: input.username,
        email: input.email,
        passwordHash: await hashPassword(input.password),
        bio: null,
        image: null,
      }),
    );
    return this.issueToken(user);
  }

  async login(input: LoginUserDto): Promise<AuthResponseDto> {
    const user = await this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', {email: input.email})
      .getOne();
    const isValid = await verifyPassword(
      input.password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );
    if (!user || !isValid)
      throw new UnauthorizedException('Invalid email or password');
    return this.issueToken(user);
  }

  current(user: User, token: string): AuthResponseDto {
    return {
      user: {
        email: user.email,
        token,
        username: user.username,
        bio: user.bio,
        image: user.image,
      },
    };
  }

  async logout(claims: TokenClaims): Promise<void> {
    await this.blacklist.revoke(claims.jti, claims.exp);
  }

  private async issueToken(user: User): Promise<AuthResponseDto> {
    const token = await this.jwt.signAsync({sub: user.id, jti: randomUUID()});
    return this.current(user, token);
  }
}
