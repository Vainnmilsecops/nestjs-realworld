import {Check, Column, Entity, Index, PrimaryColumn} from 'typeorm';

@Entity('attachments')
@Check('CHK_attachments_positive_size', '"file_size" > 0')
@Index('UQ_attachments_user_avatar', ['ownerType', 'ownerId'], {
  unique: true,
  where: `"owner_type" = 'user'`,
})
export class Attachment {
  @PrimaryColumn({type: 'uuid', primaryKeyConstraintName: 'PK_attachments'})
  id!: string;

  @Column({type: 'varchar', length: 128})
  url!: string;

  @Column({name: 'file_name', type: 'varchar', length: 64})
  fileName!: string;

  @Column({name: 'file_type', type: 'varchar', length: 64})
  fileType!: string;

  @Column({name: 'file_size', type: 'integer'})
  fileSize!: number;

  @Column({name: 'owner_type', type: 'varchar', length: 32})
  ownerType!: string;

  @Column({name: 'owner_id', type: 'uuid'})
  ownerId!: string;
}
