import {
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {InjectRepository} from '@nestjs/typeorm';
import {isUUID} from 'class-validator';
import {randomUUID} from 'node:crypto';
import {mkdir, open, readFile, unlink} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {EntityManager, Repository} from 'typeorm';
import {Attachment} from './attachment.entity';

export const MAX_AVATAR_FILE_SIZE = 2 * 1024 * 1024;

const USER_OWNER_TYPE = 'user';
const AVATAR_EXTENSIONS = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);
const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const RIFF_SIGNATURE = Buffer.from('RIFF');
const WEBP_SIGNATURE = Buffer.from('WEBP');

@Injectable()
export class AttachmentsService {
  private readonly logger = new Logger(AttachmentsService.name);
  private readonly uploadDirectory: string;

  constructor(
    @InjectRepository(Attachment)
    private readonly attachments: Repository<Attachment>,
    config: ConfigService,
  ) {
    this.uploadDirectory = resolve(
      config.get<string>('AVATAR_UPLOAD_DIR')?.trim() || '.local/uploads',
    );
  }

  async storeAvatar(
    userId: string,
    file: {buffer: Buffer},
  ): Promise<Attachment> {
    const fileSize = file.buffer.length;
    if (fileSize > MAX_AVATAR_FILE_SIZE) {
      throw new PayloadTooLargeException('Avatar exceeds 2 MiB');
    }
    const fileType = detectAvatarType(file.buffer);
    const id = randomUUID();
    const attachment = this.attachments.create({
      id,
      url: `/api/attachments/${id}`,
      fileName: getFileName(id, fileType),
      fileType,
      fileSize,
      ownerType: USER_OWNER_TYPE,
      ownerId: userId,
    });

    await mkdir(this.uploadDirectory, {recursive: true, mode: 0o700});
    const handle = await open(this.filePath(attachment), 'wx', 0o600);
    try {
      try {
        await handle.writeFile(file.buffer);
      } finally {
        await handle.close();
      }
    } catch (error) {
      await this.removeFile(attachment);
      throw error;
    }
    return attachment;
  }

  // The caller holds the user's row lock while switching the avatar and its URL.
  async replaceAvatar(
    manager: EntityManager,
    userId: string,
    next: Attachment | null,
  ): Promise<Attachment | null> {
    const attachments = manager.getRepository(Attachment);
    const previous = await attachments.findOneBy({
      ownerType: USER_OWNER_TYPE,
      ownerId: userId,
    });
    if (previous) await attachments.delete(previous.id);
    if (next) await attachments.insert(next);
    return previous;
  }

  async readOwnedAvatar(
    id: string,
    userId: string,
  ): Promise<{file: Buffer; fileType: string}> {
    if (!isUUID(id, '4')) throw new NotFoundException('Attachment not found');
    const attachment = await this.attachments.findOneBy({
      id,
      ownerType: USER_OWNER_TYPE,
      ownerId: userId,
    });
    if (!attachment) throw new NotFoundException('Attachment not found');
    try {
      const file = await readFile(this.filePath(attachment));
      return {file, fileType: attachment.fileType};
    } catch (error) {
      if (isMissingFile(error))
        throw new NotFoundException('Attachment not found');
      throw error;
    }
  }

  async removeFile(attachment: Attachment): Promise<void> {
    try {
      await unlink(this.filePath(attachment));
    } catch (error) {
      if (!isMissingFile(error)) {
        this.logger.warn({
          event: 'avatar_cleanup_failed',
          attachmentId: attachment.id,
          cause: error instanceof Error ? error.name : 'unknown',
        });
      }
    }
  }

  private filePath(attachment: Attachment): string {
    return join(
      this.uploadDirectory,
      getFileName(attachment.id, attachment.fileType),
    );
  }
}

function detectAvatarType(file: Buffer): string {
  if (file.subarray(0, JPEG_SIGNATURE.length).equals(JPEG_SIGNATURE)) {
    return 'image/jpeg';
  }
  if (file.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    return 'image/png';
  }
  if (
    file.subarray(0, 4).equals(RIFF_SIGNATURE) &&
    file.subarray(8, 12).equals(WEBP_SIGNATURE)
  ) {
    return 'image/webp';
  }
  throw new UnprocessableEntityException(
    'Avatar must be a JPEG, PNG, or WebP image',
  );
}

function getFileName(id: string, fileType: string): string {
  const extension = AVATAR_EXTENSIONS.get(fileType);
  if (!extension || !isUUID(id, '4')) {
    throw new Error('Invalid stored attachment metadata');
  }
  return `${id}.${extension}`;
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
