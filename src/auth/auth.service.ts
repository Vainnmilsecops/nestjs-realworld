import {
  Injectable,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {JwtService} from '@nestjs/jwt';
import {InjectRepository} from '@nestjs/typeorm';
import {randomUUID} from 'node:crypto';
import {Repository} from 'typeorm';
import type {Attachment} from '../attachments/attachment.entity';
import {AttachmentsService} from '../attachments/attachments.service';
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
    private readonly attachments: AttachmentsService,
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
    avatar?: {buffer: Buffer; size: number},
  ): Promise<AuthResponseDto> {
    if (avatar && input.image !== undefined) {
      throw new UnprocessableEntityException('Send either avatar or image');
    }
    const changes: Partial<User> = {};
    if (input.username !== undefined) changes.username = input.username;
    if (input.email !== undefined) changes.email = input.email;
    if (input.bio !== undefined) changes.bio = input.bio;
    if (input.image !== undefined) changes.image = input.image;
    if (input.password !== undefined) {
      changes.passwordHash = await hashPassword(input.password);
    }
    if (!avatar && Object.keys(changes).length === 0) {
      return this.current(user, token);
    }

    const attachment = avatar
      ? await this.attachments.storeAvatar(user.id, avatar)
      : null;
    let result: {user: User; previous: Attachment | null};
    try {
      result = await this.users.manager.transaction(async (manager) => {
        const currentUser = await manager.findOne(User, {
          where: {id: user.id},
          lock: {mode: 'pessimistic_write'},
        });
        if (!currentUser) {
          throw new UnauthorizedException('User no longer exists');
        }
        if (attachment) changes.image = attachment.url;
        const previous =
          changes.image === undefined
            ? null
            : await this.attachments.replaceAvatar(
                manager,
                user.id,
                attachment,
              );
        await manager.update(User, user.id, changes);
        return {user: Object.assign(currentUser, changes), previous};
      });
    } catch (error) {
      if (attachment) await this.attachments.removeFile(attachment);
      throw error;
    }
    if (result.previous) await this.attachments.removeFile(result.previous);
    return this.current(result.user, token);
  }

  async logout(claims: TokenClaims): Promise<void> {
    await this.blacklist.revoke(claims.jti, claims.exp);
  }

  private async issueToken(user: User): Promise<AuthResponseDto> {
    const token = await this.jwt.signAsync({sub: user.id, jti: randomUUID()});
    return this.current(user, token);
  }
}
