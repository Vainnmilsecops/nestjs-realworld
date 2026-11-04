import {ApiProperty, ApiPropertyOptional} from '@nestjs/swagger';
import {Transform} from 'class-transformer';
import {IsIn, IsString, Length, ValidateIf} from 'class-validator';

export const languages = ['en', 'vi'] as const;
export type Language = (typeof languages)[number];

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
    enum: languages,
    description: 'Overrides Accept-Language',
  })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsIn(languages)
  lang?: Language;
}

export class HelloResponseDto {
  @ApiProperty({example: 'Xin chào, An!'})
  message!: string;

  @ApiProperty({enum: languages, example: 'vi'})
  language!: Language;
}
