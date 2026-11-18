import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {Attachment} from './attachment.entity';
import {AttachmentsService} from './attachments.service';

@Module({
  imports: [TypeOrmModule.forFeature([Attachment])],
  providers: [AttachmentsService],
  exports: [AttachmentsService],
})
export class AttachmentsModule {}
