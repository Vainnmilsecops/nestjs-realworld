import {join} from 'node:path';
import {PostgresConnectionOptions} from 'typeorm/driver/postgres/PostgresConnectionOptions';
import {Attachment} from '../attachments/attachment.entity';
import {Follow} from '../users/entities/follow.entity';
import {User} from '../users/entities/user.entity';
import {EnvironmentError} from '../config/environment';

export function databaseOptions(url: string): PostgresConnectionOptions {
  if (!url || !/^postgres(?:ql)?:\/\//.test(url)) {
    throw new EnvironmentError(
      'DATABASE_URL must be a PostgreSQL connection URL',
    );
  }
  return {
    type: 'postgres',
    url,
    entities: [User, Follow, Attachment],
    migrations: [
      join(
        __dirname,
        'migrations',
        `[0-9]*-*.${__filename.endsWith('.ts') ? 'ts' : 'js'}`,
      ),
    ],
    migrationsTableName: 'migrations',
    migrationsRun: false,
    synchronize: false,
    installExtensions: false,
    uuidExtension: 'pgcrypto',
  };
}
