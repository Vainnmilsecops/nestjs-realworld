import {Injectable, UnauthorizedException} from '@nestjs/common';
import {JwtService} from '@nestjs/jwt';
import {InjectRepository} from '@nestjs/typeorm';
import {randomUUID} from 'node:crypto';
import {Repository} from 'typeorm';
import {TokenBlacklistService} from '../redis/token-blacklist.service';
import {User} from '../users/entities/user.entity';
import {
  AuthResponseDto,
  LoginUserDto,
  RegisterUserDto,
  UpdateUserDto,
} from './auth.dto';
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

  async update(
    user: User,
    token: string,
    input: UpdateUserDto,
  ): Promise<AuthResponseDto> {
    const changes: Partial<User> = {};
    if (input.username !== undefined) changes.username = input.username;
    if (input.email !== undefined) changes.email = input.email;
    if (input.bio !== undefined) changes.bio = input.bio;
    if (input.image !== undefined) changes.image = input.image;
    if (input.password !== undefined) {
      changes.passwordHash = await hashPassword(input.password);
    }
    if (Object.keys(changes).length === 0) return this.current(user, token);

    const {affected} = await this.users.update(user.id, changes);
    const updated =
      affected === 0 ? null : await this.users.findOneBy({id: user.id});
    if (!updated) throw new UnauthorizedException('User no longer exists');
    return this.current(updated, token);
  }

  async logout(claims: TokenClaims): Promise<void> {
    await this.blacklist.revoke(claims.jti, claims.exp);
  }

  private async issueToken(user: User): Promise<AuthResponseDto> {
    const token = await this.jwt.signAsync({sub: user.id, jti: randomUUID()});
    return this.current(user, token);
  }
}
