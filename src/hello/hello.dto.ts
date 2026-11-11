import {ApiProperty, ApiPropertyOptional} from '@nestjs/swagger';
import {Transform} from 'class-transformer';
import {IsIn, IsString, Length, ValidateIf} from 'class-validator';
import {
  SUPPORTED_LANGUAGES,
  VIETNAMESE,
  type Language,
} from '../i18n/languages';

export class HelloQueryDto {
  @ApiPropertyOptional({example: 'An', minLength: 1, maxLength: 80})
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(({value}: {value: unknown}) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 80)
  name?: string;

  @ApiPropertyOptional({
    enum: SUPPORTED_LANGUAGES,
    description: 'Overrides Accept-Language',
  })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsIn(SUPPORTED_LANGUAGES)
  lang?: Language;
}

export class HelloResponseDto {
  @ApiProperty({example: 'Xin chào, An!'})
  message!: string;

  @ApiProperty({enum: SUPPORTED_LANGUAGES, example: VIETNAMESE})
  language!: Language;
}
