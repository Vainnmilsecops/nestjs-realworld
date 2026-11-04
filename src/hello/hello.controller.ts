import {Controller, Get, Query} from '@nestjs/common';
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {I18n, I18nContext} from 'nestjs-i18n';
import {HelloQueryDto, HelloResponseDto, languages} from './hello.dto';
import {HelloService} from './hello.service';

@ApiTags('hello')
@Controller('hello')
export class HelloController {
  constructor(private readonly hello: HelloService) {}

  @Get()
  @ApiOperation({summary: 'Greet the caller in English or Vietnamese'})
  @ApiHeader({
    name: 'Accept-Language',
    required: false,
    example: 'vi-VN, en;q=0.8',
  })
  @ApiOkResponse({type: HelloResponseDto})
  @ApiResponse({
    status: 422,
    description: 'Invalid or unsupported query parameters',
  })
  greet(
    @Query() query: HelloQueryDto,
    @I18n() context: I18nContext,
  ): HelloResponseDto {
    const resolved = context.lang.split('-')[0];
    const language = query.lang ?? (resolved === languages[1] ? 'vi' : 'en');
    return this.hello.greet(query.name, language);
  }
}
