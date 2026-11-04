import {Transform, Type} from 'class-transformer';
import {IsDefined, IsEmail, IsObject, IsString, IsUrl, Length, Matches, MaxLength, ValidateIf, ValidateNested} from 'class-validator';

export class RegisterUserDto {
  @Transform(({value}: {value: unknown}) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @Length(1, 50)
  @Matches(/^[a-zA-Z0-9_.-]+$/)
  username!: string;

  @Transform(({value}: {value: unknown}) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail()
  @Length(3, 254)
  email!: string;

  @IsString()
  @Length(8, 128)
  password!: string;
}

export class RegisterUserBody {
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => RegisterUserDto)
  user!: RegisterUserDto;
}

export class LoginUserDto {
  @Transform(({value}: {value: unknown}) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail()
  @Length(3, 254)
  email!: string;

  @IsString()
  @Length(1, 128)
  password!: string;
}

export class LoginUserBody {
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => LoginUserDto)
  user!: LoginUserDto;
}

export class UpdateUserDto {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(({value}: {value: unknown}) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @Length(1, 50)
  @Matches(/^[a-zA-Z0-9_.-]+$/)
  username?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(({value}: {value: unknown}) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail()
  @Length(3, 254)
  email?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @Length(8, 128)
  password?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(10000)
  bio?: string | null;

  @ValidateIf((_object, value: unknown) => value !== undefined && value !== null)
  @IsUrl({protocols: ['http', 'https'], require_protocol: true})
  @MaxLength(2048)
  image?: string | null;
}

export class UpdateUserBody {
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => UpdateUserDto)
  user!: UpdateUserDto;
}
