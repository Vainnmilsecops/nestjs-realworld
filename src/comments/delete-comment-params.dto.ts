import {Type} from 'class-transformer';
import {IsInt, IsNotEmpty, IsString, Max, Min} from 'class-validator';

export class DeleteCommentParamsDto {
  @IsString()
  @IsNotEmpty()
  slug!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  id!: number;
}
