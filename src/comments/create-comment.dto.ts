import {Type} from 'class-transformer';
import {
  IsDefined,
  IsNotEmpty,
  IsObject,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, {message: 'body must contain non-whitespace characters'})
  @MaxLength(20000)
  body!: string;
}

export class CreateCommentRequestDto {
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => CreateCommentDto)
  comment!: CreateCommentDto;
}
