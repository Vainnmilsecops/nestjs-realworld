import 'reflect-metadata';
import 'dotenv/config';
import {mkdir, readdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {DataSource, MigrationExecutor} from 'typeorm';

export function assertResetAllowed(
  args: string[],
  environment: string | undefined,
): void {
  if (!['development', 'test'].includes(environment ?? '')) {
    throw new Error(
      'Migration reset is allowed only in NODE_ENV=development or test',
    );
  }
  if (args.length !== 1 || args[0] !== '--confirm-reset') {
    throw new Error(
      'Reset removes migrated data; pass --confirm-reset explicitly',
    );
  }
}

export async function addMigration(
  name: string,
  directory = resolve(__dirname, '../src/database/migrations'),
): Promise<string> {
  if (!/^[A-Z][A-Za-z0-9]*$/.test(name)) {
    throw new Error(
      'Migration name must use PascalCase letters and digits, for example AddUserBio',
    );
  }
  await mkdir(directory, {recursive: true});
  const latest = (await readdir(directory)).reduce((maximum, entry) => {
    const timestamp = /^(\d{13})-/.exec(entry)?.[1];
    return Math.max(maximum, timestamp ? Number(timestamp) : 0);
  }, 0);
  const timestamp = Math.max(Date.now(), latest + 1);
  const filename = resolve(directory, `${timestamp}-${name}.ts`);
  const source = `import {MigrationInterface, QueryRunner} from 'typeorm';

export class ${name}${timestamp} implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // Add the forward SQL manually, using queryRunner.query().
    void queryRunner;
    throw new Error('Implement ${name}.up SQL before applying this migration');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Add the corresponding rollback SQL manually.
    void queryRunner;
    throw new Error('Implement ${name}.down SQL before reverting this migration');
  }
}
`;
  await writeFile(filename, source, {encoding: 'utf8', flag: 'wx'});
  return filename;
}

export async function resetMigrations(dataSource: DataSource): Promise<void> {
  const executed = await new MigrationExecutor(
    dataSource,
  ).getExecutedMigrations();
  for (let index = 0; index < executed.length; index++) {
    await dataSource.undoLastMigration();
  }
  await dataSource.runMigrations();
}

export async function runMigrationCommand(args: string[]): Promise<void> {
  const [command, ...parameters] = args;
  if (command === 'add') {
    if (parameters.length !== 1 || !parameters[0]) {
      throw new Error('Usage: npm run migration:add -- MigrationName');
    }
    console.log(`Created ${await addMigration(parameters[0])}`);
    return;
  }
  if (!['run', 'revert', 'reset'].includes(command ?? '')) {
    throw new Error(
      'Choose a migration command: add Name, run, revert, reset --confirm-reset',
    );
  }
  if (command === 'reset') {
    assertResetAllowed(parameters, process.env.NODE_ENV);
  } else if (parameters.length !== 0) {
    throw new Error(`The ${command} command does not accept extra arguments`);
  }

  const {default: dataSource} = await import('../src/database/data-source');
  try {
    await dataSource.initialize();
    if (command === 'run') await dataSource.runMigrations();
    if (command === 'revert') await dataSource.undoLastMigration();
    if (command === 'reset') await resetMigrations(dataSource);
  } finally {
    if (dataSource.isInitialized) await dataSource.destroy();
  }
}

if (require.main === module) {
  void runMigrationCommand(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
