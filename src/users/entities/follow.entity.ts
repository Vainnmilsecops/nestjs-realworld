import {
  Check,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import {User} from './user.entity';

@Entity('follows')
@Check('CHK_follows_no_self_follow', '"follower_id" <> "following_id"')
@Index('IDX_follows_following_id', ['followingId'])
export class Follow {
  @PrimaryColumn({
    name: 'follower_id',
    type: 'uuid',
    primaryKeyConstraintName: 'PK_follows',
  })
  followerId!: string;

  @PrimaryColumn({
    name: 'following_id',
    type: 'uuid',
    primaryKeyConstraintName: 'PK_follows',
  })
  followingId!: string;

  @ManyToOne(() => User, {nullable: false, onDelete: 'CASCADE'})
  @JoinColumn({
    name: 'follower_id',
    foreignKeyConstraintName: 'FK_follows_follower',
  })
  follower!: User;

  @ManyToOne(() => User, {nullable: false, onDelete: 'CASCADE'})
  @JoinColumn({
    name: 'following_id',
    foreignKeyConstraintName: 'FK_follows_following',
  })
  following!: User;
}
