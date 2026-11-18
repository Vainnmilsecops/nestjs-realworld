import {
  Controller,
  Get,
  Param,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {AttachmentsService} from '../attachments/attachments.service';
import type {User} from '../users/entities/user.entity';
import {CurrentUser} from './current-user.decorator';
import {JwtAuthGuard} from './jwt-auth.guard';

@ApiTags('attachments')
@ApiSecurity('token')
@UseGuards(JwtAuthGuard)
@Controller('attachments')
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @Get(':id')
  @ApiOperation({summary: 'Download your uploaded avatar'})
  @ApiProduces('image/jpeg', 'image/png', 'image/webp')
  @ApiOkResponse({schema: {type: 'string', format: 'binary'}})
  @ApiNotFoundResponse({description: 'Attachment not found'})
  @ApiUnauthorizedResponse({description: 'Authentication required'})
  async getAvatar(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<StreamableFile> {
    const {file, fileType} = await this.attachments.readOwnedAvatar(
      id,
      user.id,
    );
    return new StreamableFile(file, {type: fileType});
  }
}
