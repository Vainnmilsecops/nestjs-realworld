import {Any, EntityManager} from 'typeorm';
import {Follow} from './entities/follow.entity';
import type {User} from './entities/user.entity';
import {profileImage} from './profile-image';
import type {ProfileDto} from './profiles.dto';

export async function followedAuthorIds(
  manager: EntityManager,
  authorIds: string[],
  viewerId?: string,
): Promise<Set<string>> {
  if (viewerId === undefined || authorIds.length === 0) return new Set();
  const follows = await manager.getRepository(Follow).find({
    where: {
      followerId: viewerId,
      followingId: Any([...new Set(authorIds)]),
    },
    select: {followingId: true},
  });
  return new Set(follows.map((follow) => follow.followingId));
}

export function toProfile(
  user: Pick<User, 'id' | 'username' | 'bio' | 'image'>,
  following: boolean,
  viewerId?: string,
): ProfileDto {
  return {
    username: user.username,
    bio: user.bio,
    image: profileImage(user, viewerId),
    following,
  };
}
