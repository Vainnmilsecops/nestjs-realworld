import {Type} from 'class-transformer';
import {IsDefined, IsObject, IsString, Matches, MaxLength, ValidateIf, ValidateNested} from 'class-validator';

export class UpdateArticleDto {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @Matches(/\S/, {message: 'title must not be blank'})
  @MaxLength(200)
  title?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @Matches(/\S/, {message: 'description must not be blank'})
  @MaxLength(10000)
  description?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @Matches(/\S/, {message: 'body must not be blank'})
  @MaxLength(1000000)
  body?: string;
}

export class UpdateArticleRequest {
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => UpdateArticleDto)
  article!: UpdateArticleDto;
}
