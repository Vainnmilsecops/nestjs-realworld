import {ApiProperty} from '@nestjs/swagger';

export class ProfileDto {
  @ApiProperty({example: 'trainee_01'})
  username!: string;

  @ApiProperty({type: String, nullable: true, example: null})
  bio!: string | null;

  @ApiProperty({type: String, nullable: true, example: null})
  image!: string | null;

  @ApiProperty({example: false})
  following!: boolean;
}

export class ProfileResponseDto {
  @ApiProperty({type: ProfileDto})
  profile!: ProfileDto;
}
