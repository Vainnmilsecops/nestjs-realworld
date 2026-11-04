import {Injectable, NotFoundException} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository} from 'typeorm';
import {ProfilePresenter} from '../common/profile.presenter';
import {User} from '../database/entities';

@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
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
}
