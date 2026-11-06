import {ApiProperty} from '@nestjs/swagger';
import {Transform, Type} from 'class-transformer';
import {
  IsDefined,
  IsEmail,
  IsObject,
  IsString,
  Length,
  Matches,
  ValidateNested,
} from 'class-validator';

function normalizeEmail({value}: {value: unknown}): unknown {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

export class RegisterUserDto {
  @ApiProperty({example: 'trainee_01', minLength: 3, maxLength: 50})
  @Transform(({value}: {value: unknown}) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(3, 50)
  @Matches(/^[a-zA-Z0-9_-]+$/)
  username!: string;

  @ApiProperty({example: 'trainee@example.com', maxLength: 254})
  @Transform(normalizeEmail)
  @IsEmail()
  @Length(3, 254)
  email!: string;

  @ApiProperty({
    example: 'training-password',
    minLength: 8,
    maxLength: 128,
    writeOnly: true,
  })
  @IsString()
  @Length(8, 128)
  password!: string;
}

export class RegisterUserRequestDto {
  @ApiProperty({type: RegisterUserDto})
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => RegisterUserDto)
  user!: RegisterUserDto;
}

export class LoginUserDto {
  @ApiProperty({example: 'trainee@example.com', maxLength: 254})
  @Transform(normalizeEmail)
  @IsEmail()
  @Length(3, 254)
  email!: string;

  @ApiProperty({
    example: 'training-password',
    minLength: 8,
    maxLength: 128,
    writeOnly: true,
  })
  @IsString()
  @Length(8, 128)
  password!: string;
}

export class LoginUserRequestDto {
  @ApiProperty({type: LoginUserDto})
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => LoginUserDto)
  user!: LoginUserDto;
}

export class AuthUserDto {
  @ApiProperty({example: 'trainee@example.com'}) email!: string;
  @ApiProperty({
    description: 'JWT for Authorization: Token <jwt> or Bearer <jwt>',
  })
  token!: string;
  @ApiProperty({example: 'trainee_01'}) username!: string;
  @ApiProperty({type: String, nullable: true, example: null}) bio!:
    string | null;
  @ApiProperty({type: String, nullable: true, example: null}) image!:
    string | null;
}

export class AuthResponseDto {
  @ApiProperty({type: AuthUserDto}) user!: AuthUserDto;
}
