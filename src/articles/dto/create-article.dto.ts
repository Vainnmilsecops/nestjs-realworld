import {Type, Transform} from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsDefined, IsObject, IsString, Matches, MaxLength,
  ValidateIf, ValidateNested,
} from 'class-validator';

export class CreateArticleDto {
  @IsString()
  @Matches(/\S/, {message: 'title must not be blank'})
  @MaxLength(200)
  title!: string;

  @IsString()
  @Matches(/\S/, {message: 'description must not be blank'})
  @MaxLength(10000)
  description!: string;

  @IsString()
  @Matches(/\S/, {message: 'body must not be blank'})
  @MaxLength(1000000)
  body!: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(({value}: {value: unknown}) =>
    Array.isArray(value)
      ? [...new Set(value.map((tag: unknown) => typeof tag === 'string' ? tag.trim() : tag))]
      : value,
  )
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({each: true})
  @Matches(/\S/, {each: true, message: 'tags must not be blank'})
  @MaxLength(50, {each: true})
  tagList?: string[];
}

export class CreateArticleRequest {
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => CreateArticleDto)
  article!: CreateArticleDto;
}
