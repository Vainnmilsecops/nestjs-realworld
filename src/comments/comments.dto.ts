import {ApiProperty} from '@nestjs/swagger';
import {Transform, Type} from 'class-transformer';
import {
  IsDefined,
  IsInt,
  IsObject,
  IsString,
  Matches,
  Max,
  Min,
  NotContains,
  ValidateNested,
} from 'class-validator';
import {ProfileDto} from '../users/profiles.dto';

const MAX_COMMENT_ID = 2_147_483_647;

export class CommentInputDto {
  @ApiProperty({example: 'Cảm ơn bạn đã chia sẻ bài viết!'})
  @IsString()
  @Matches(/\S/)
  @NotContains('\u0000')
  body!: string;
}

export class CreateCommentRequestDto {
  @ApiProperty({type: CommentInputDto})
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => CommentInputDto)
  comment!: CommentInputDto;
}

export class DeleteCommentParamsDto {
  @ApiProperty({example: 'lam-quen-voi-nestjs'})
  @IsString()
  slug!: string;

  @ApiProperty({
    type: 'integer',
    minimum: 1,
    maximum: MAX_COMMENT_ID,
    example: 1,
  })
  @Transform(({value}: {value: unknown}) =>
    typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value,
  )
  @IsInt()
  @Min(1)
  @Max(MAX_COMMENT_ID)
  id!: number;
}

export class CommentDto {
  @ApiProperty({
    type: 'integer',
    minimum: 1,
    maximum: MAX_COMMENT_ID,
    example: 1,
  })
  id!: number;

  @ApiProperty({example: 'Cảm ơn bạn đã chia sẻ bài viết!'})
  body!: string;

  @ApiProperty({type: String, format: 'date-time'})
  createdAt!: string;

  @ApiProperty({type: String, format: 'date-time'})
  updatedAt!: string;

  @ApiProperty({type: ProfileDto})
  author!: ProfileDto;
}

export class CommentResponseDto {
  @ApiProperty({type: CommentDto})
  comment!: CommentDto;
}

export class CommentListResponseDto {
  @ApiProperty({type: [CommentDto]})
  comments!: CommentDto[];
}
