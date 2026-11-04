import {randomBytes} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';

const template = await readFile(new URL('../.env.example', import.meta.url), 'utf8');
try {
  await writeFile(
    new URL('../.env', import.meta.url),
    template.replace('JWT_SECRET=', `JWT_SECRET=${randomBytes(48).toString('hex')}`),
    {flag: 'wx'},
  );
  console.log('Created .env. Review DATABASE_URL before running migrations.');
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  console.log('.env already exists; kept the existing settings.');
}
