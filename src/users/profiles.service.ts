import {Injectable, NotFoundException} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository} from 'typeorm';
import {Follow} from './entities/follow.entity';
import {User} from './entities/user.entity';
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
    const user = await this.users.findOne({
      where: {username},
      select: {id: true, username: true, bio: true, image: true},
    });
    if (!user) throw new NotFoundException('Profile not found');

    const following =
      viewerId !== undefined &&
      (await this.follows.existsBy({
        followerId: viewerId,
        followingId: user.id,
      }));
    return {
      profile: {
        username: user.username,
        bio: user.bio,
        image: user.image,
        following,
      },
    };
  }
}
