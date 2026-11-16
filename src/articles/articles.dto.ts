import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from '@nestjs/swagger';
import {Transform, Type} from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDefined,
  IsInt,
  IsObject,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  NotContains,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {ProfileDto} from '../users/profiles.dto';

const MAX_TITLE_LENGTH = 255;
const MAX_TAG_LENGTH = 50;
const MAX_TAG_COUNT = 20;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MAX_OFFSET = 2_147_483_647;

function trimString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function parseQueryInteger({value}: {value: unknown}): unknown {
  return typeof value === 'string' && /^\d+$/.test(value)
    ? Number(value)
    : value;
}

export class ArticleInputDto {
  @ApiProperty({example: 'Làm quen với NestJS', maxLength: MAX_TITLE_LENGTH})
  @Transform(({value}: {value: unknown}) => trimString(value))
  @IsString()
  @Matches(/\S/)
  @MaxLength(MAX_TITLE_LENGTH)
  @NotContains('\u0000')
  title!: string;

  @ApiProperty({example: 'Hướng dẫn viết API đầu tiên'})
  @Transform(({value}: {value: unknown}) => trimString(value))
  @IsString()
  @Matches(/\S/)
  @NotContains('\u0000')
  description!: string;

  @ApiProperty({example: 'Nội dung bài viết'})
  @IsString()
  @Matches(/\S/)
  @NotContains('\u0000')
  body!: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['nestjs'],
    maxItems: MAX_TAG_COUNT,
  })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(({value}: {value: unknown}) =>
    Array.isArray(value) ? value.map(trimString) : value,
  )
  @IsArray()
  @ArrayMaxSize(MAX_TAG_COUNT)
  @IsString({each: true})
  @Matches(/\S/, {each: true})
  @MaxLength(MAX_TAG_LENGTH, {each: true})
  @NotContains('\u0000', {each: true})
  tagList?: string[];
}

export class CreateArticleRequestDto {
  @ApiProperty({type: ArticleInputDto})
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => ArticleInputDto)
  article!: ArticleInputDto;
}

export class UpdateArticleDto extends PartialType(
  OmitType(ArticleInputDto, ['tagList'] as const),
  {skipNullProperties: false},
) {}

export class UpdateArticleRequestDto {
  @ApiProperty({type: UpdateArticleDto})
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => UpdateArticleDto)
  article!: UpdateArticleDto;
}

export class PaginationQueryDto {
  @ApiPropertyOptional({
    type: 'integer',
    minimum: 1,
    maximum: MAX_LIMIT,
    default: DEFAULT_LIMIT,
  })
  @Transform(parseQueryInteger)
  @IsInt()
  @Min(1)
  @Max(MAX_LIMIT)
  limit = DEFAULT_LIMIT;

  @ApiPropertyOptional({
    type: 'integer',
    minimum: 0,
    maximum: MAX_OFFSET,
    default: 0,
  })
  @Transform(parseQueryInteger)
  @IsInt()
  @Min(0)
  @Max(MAX_OFFSET)
  offset = 0;
}

export class ArticleQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({example: 'nestjs', maxLength: MAX_TAG_LENGTH})
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(({value}: {value: unknown}) => trimString(value))
  @IsString()
  @Matches(/\S/)
  @MaxLength(MAX_TAG_LENGTH)
  @NotContains('\u0000')
  tag?: string;

  @ApiPropertyOptional({example: 'trainee_01', maxLength: 50})
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(({value}: {value: unknown}) => trimString(value))
  @IsString()
  @Matches(/\S/)
  @MaxLength(50)
  @NotContains('\u0000')
  author?: string;
}

export class ArticleSummaryDto {
  @ApiProperty({example: 'lam-quen-voi-nestjs'})
  slug!: string;

  @ApiProperty({example: 'Làm quen với NestJS'})
  title!: string;

  @ApiProperty({example: 'Hướng dẫn viết API đầu tiên'})
  description!: string;

  @ApiProperty({type: [String], example: ['nestjs']})
  tagList!: string[];

  @ApiProperty({type: String, format: 'date-time'})
  createdAt!: string;

  @ApiProperty({type: String, format: 'date-time'})
  updatedAt!: string;

  @ApiProperty({example: false})
  favorited!: boolean;

  @ApiProperty({type: 'integer', example: 0, minimum: 0})
  favoritesCount!: number;

  @ApiProperty({type: ProfileDto})
  author!: ProfileDto;
}

export class ArticleDto extends ArticleSummaryDto {
  @ApiProperty({example: 'Nội dung bài viết'})
  body!: string;
}

export class ArticleResponseDto {
  @ApiProperty({type: ArticleDto})
  article!: ArticleDto;
}

export class ArticleListResponseDto {
  @ApiProperty({type: [ArticleSummaryDto]})
  articles!: ArticleSummaryDto[];

  @ApiProperty({type: 'integer', example: 1, minimum: 0})
  articlesCount!: number;
}
