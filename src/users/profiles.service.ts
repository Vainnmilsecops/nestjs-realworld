import {Injectable, NotFoundException, UnprocessableEntityException} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository} from 'typeorm';
import {ProfilePresenter} from '../common/profile.presenter';
import {Follow, User} from '../database/entities';

@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Follow) private readonly follows: Repository<Follow>,
    private readonly profiles: ProfilePresenter,
  ) {}

  async findUser(username: string): Promise<User> {
    const user = await this.users.findOneBy({username});
    if (!user) throw new NotFoundException('Profile not found');
    return user;
  }

  async get(username: string, viewerId?: number) {
    return {profile: await this.profiles.present(await this.findUser(username), viewerId)};
  }

  async follow(username: string, viewerId: number) {
    const user = await this.findUser(username);
    if (user.id === viewerId) {
      throw new UnprocessableEntityException('You cannot follow yourself');
    }
    await this.follows.createQueryBuilder().insert()
      .values({followerId: viewerId, followingId: user.id}).orIgnore().execute();
    return {profile: await this.profiles.present(user, viewerId)};
  }

  async unfollow(username: string, viewerId: number) {
    const user = await this.findUser(username);
    await this.follows.delete({followerId: viewerId, followingId: user.id});
    return {profile: await this.profiles.present(user, viewerId)};
  }
}
