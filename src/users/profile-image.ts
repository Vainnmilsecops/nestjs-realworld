import type {User} from './entities/user.entity';

export function profileImage(
  user: Pick<User, 'id' | 'image'>,
  viewerId?: string,
): string | null {
  if (user.id !== viewerId && user.image?.startsWith('/api/attachments/')) {
    return null;
  }
  return user.image;
}
