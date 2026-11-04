import {Injectable} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository} from 'typeorm';
import {Follow, User} from '../database/entities';

export interface ProfileView {
  username: string;
  bio: string | null;
  image: string | null;
  following: boolean;
}

@Injectable()
export class ProfilePresenter {
  constructor(@InjectRepository(Follow) private readonly follows: Repository<Follow>) {}

  async present(user: User, viewerId?: number): Promise<ProfileView> {
    const following = viewerId !== undefined && await this.follows.existsBy({
      followerId: viewerId, followingId: user.id,
    });
    return {username: user.username, bio: user.bio, image: user.image, following};
  }
}
