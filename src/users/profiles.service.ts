import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository} from 'typeorm';
import {Follow} from './entities/follow.entity';
import {User} from './entities/user.entity';
import {profileImage} from './profile-image';
import {ProfileResponseDto} from './profiles.dto';

@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Follow) private readonly follows: Repository<Follow>,
  ) {}

  async getProfile(
    username: string,
    viewerId?: string,
  ): Promise<ProfileResponseDto> {
    const user = await this.findProfile(username);
    const following =
      viewerId !== undefined &&
      (await this.follows.existsBy({
        followerId: viewerId,
        followingId: user.id,
      }));
    return this.profileResponse(user, following, viewerId);
  }

  async follow(
    username: string,
    viewerId: string,
  ): Promise<ProfileResponseDto> {
    const user = await this.findProfile(username);
    if (user.id === viewerId) {
      throw new UnprocessableEntityException('Cannot follow yourself');
    }
    await this.follows
      .createQueryBuilder()
      .insert()
      .values({followerId: viewerId, followingId: user.id})
      .orIgnore()
      .execute();
    return this.profileResponse(user, true, viewerId);
  }

  async unfollow(
    username: string,
    viewerId: string,
  ): Promise<ProfileResponseDto> {
    const user = await this.findProfile(username);
    if (user.id === viewerId) {
      throw new UnprocessableEntityException('Cannot unfollow yourself');
    }
    await this.follows.delete({followerId: viewerId, followingId: user.id});
    return this.profileResponse(user, false, viewerId);
  }

  private async findProfile(username: string): Promise<User> {
    const user = await this.users.findOne({
      where: {username},
      select: {id: true, username: true, bio: true, image: true},
    });
    if (!user) throw new NotFoundException('Profile not found');
    return user;
  }

  private profileResponse(
    user: User,
    following: boolean,
    viewerId?: string,
  ): ProfileResponseDto {
    return {
      profile: {
        username: user.username,
        bio: user.bio,
        image: profileImage(user, viewerId),
        following,
      },
    };
  }
}
