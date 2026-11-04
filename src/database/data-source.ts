import 'reflect-metadata';
import 'dotenv/config';
import {DataSource} from 'typeorm';
import {entities} from './entities';
import {InitialSchema1700000000000} from './migrations/1700000000000-initial-schema';

export function databaseOptions(url: string) {
  return {
    type: 'postgres' as const,
    url,
    entities,
    migrations: [InitialSchema1700000000000],
    synchronize: false,
  };
}

export default new DataSource(databaseOptions(process.env.DATABASE_URL ?? ''));
