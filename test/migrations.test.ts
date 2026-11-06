import 'reflect-metadata';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {basename, dirname, join, resolve} from 'node:path';
import {describe, it} from 'node:test';
import {runInNewContext} from 'node:vm';
import {ModuleKind, transpileModule} from 'typescript';
import {
  addMigration,
  assertResetAllowed,
  runMigrationCommand,
} from '../scripts/migrations';
import {databaseOptions} from '../src/database/database-options';

describe('Manual migration tooling', () => {
  it('keeps schema changes and extension installation manual', () => {
    const options = databaseOptions('postgresql://user:password@localhost/app');
    assert.equal(options.synchronize, false);
    assert.equal(options.migrationsRun, false);
    assert.equal(options.installExtensions, false);
    assert.throws(() => databaseOptions(''), /DATABASE_URL/);
    assert.throws(
      () => databaseOptions('mysql://localhost/app'),
      /DATABASE_URL/,
    );
  });

  it('rejects reset outside development/test, even with confirmation', () => {
    for (const environment of ['production', 'staging', undefined]) {
      assert.throws(
        () => assertResetAllowed(['--confirm-reset'], environment),
        /only in NODE_ENV/,
      );
    }
    assert.throws(
      () => assertResetAllowed([], 'development'),
      /--confirm-reset/,
    );
    assert.doesNotThrow(() =>
      assertResetAllowed(['--confirm-reset'], 'development'),
    );
    assert.doesNotThrow(() => assertResetAllowed(['--confirm-reset'], 'test'));
  });

  it('creates an empty reversible scaffold rather than generating schema SQL', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'realworld-migration-'));
    try {
      const filename = await addMigration('AddUserBio', directory);
      const source = await readFile(filename, 'utf8');
      assert.match(filename, /\d{13}-AddUserBio\.ts$/);
      assert.match(
        source,
        /export class AddUserBio\d{13} implements MigrationInterface/,
      );
      assert.match(source, /async up\(queryRunner: QueryRunner\)/);
      assert.match(source, /async down\(queryRunner: QueryRunner\)/);
      assert.doesNotMatch(source, /CREATE TABLE|ALTER TABLE|DROP TABLE/);
      const compiled = transpileModule(source, {
        compilerOptions: {module: ModuleKind.CommonJS},
      }).outputText;
      const context = {
        exports: {} as Record<
          string,
          new () => {up(): Promise<void>; down(): Promise<void>}
        >,
      };
      runInNewContext(compiled, context);
      const Migration = Object.values(context.exports)[0];
      assert.ok(Migration);
      const pending = new Migration();
      await assert.rejects(() => pending.up(), /Implement AddUserBio.up SQL/);
      await assert.rejects(
        () => pending.down(),
        /Implement AddUserBio.down SQL/,
      );
      await assert.rejects(
        () => addMigration('../UnsafeName', directory),
        /PascalCase/,
      );
      assert.equal((await readdir(directory)).length, 1);
      const aheadOfClock = Date.now() + 60000;
      await writeFile(
        join(directory, `${aheadOfClock}-Existing.ts`),
        '// Existing manual migration',
      );
      const following = await addMigration('NextChange', directory);
      assert.ok(Number(basename(following).split('-')[0]) > aheadOfClock);
    } finally {
      assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
      assert.match(directory, /realworld-migration-/);
      await rm(directory, {recursive: true, force: true});
    }
  });

  it('rejects unsupported commands and extra arguments before connecting', async () => {
    await assert.rejects(
      () => runMigrationCommand(['generate']),
      /Choose a migration/,
    );
    await assert.rejects(
      () => runMigrationCommand(['run', '--force']),
      /extra arguments/,
    );
    await assert.rejects(() => runMigrationCommand(['add']), /Usage/);
  });
});
