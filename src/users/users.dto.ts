import {Transform, Type} from 'class-transformer';
import {IsDefined, IsEmail, IsString, Length, Matches, ValidateNested} from 'class-validator';

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
  @ValidateNested()
  @Type(() => LoginUserDto)
  user!: LoginUserDto;
}
