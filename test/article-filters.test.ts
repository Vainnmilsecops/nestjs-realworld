import 'reflect-metadata';
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {ValidationPipe} from '@nestjs/common';
import type {Type} from '@nestjs/common';
import {ArticleQueryDto} from '../src/articles/articles.dto';
import {LoginUserDto} from '../src/auth/auth.dto';
import {VALIDATION_OPTIONS} from '../src/common/validation-options';
import {USERNAME_MAX_LENGTH} from '../src/users/user.constants';

const pipe = new ValidationPipe(VALIDATION_OPTIONS);
function validate(metatype: Type<unknown>, value: unknown) {
  return pipe.transform(value, {type: 'query', metatype});
}

describe('Shared filter and login rules', () => {
  it('keeps filters optional and applies the same string rules', async () => {
    await validate(ArticleQueryDto, {});
    const filters = {
      tag: 50,
      author: USERNAME_MAX_LENGTH,
      favorited: USERNAME_MAX_LENGTH,
    };
    for (const [field, length] of Object.entries(filters)) {
      const boundary = 'a'.repeat(length);
      const query = await validate(ArticleQueryDto, {[field]: ` ${boundary} `});
      assert.equal(query[field], boundary);
      for (const invalid of [' ', null, 1, ['a'], 'a\u0000b', boundary + 'a']) {
        await assert.rejects(
          () => validate(ArticleQueryDto, {[field]: invalid}),
          {status: 422},
        );
      }
    }
  });

  it('inherits login normalization, required fields and the whitelist', async () => {
    const input = {email: ' READER@Example.com ', password: 'password123'};
    const login = await validate(LoginUserDto, input);
    assert.equal(login.email, 'reader@example.com');
    const invalid = [
      {email: input.email},
      {password: input.password},
      {...input, username: 'extra'},
    ];
    for (const value of invalid) {
      await assert.rejects(() => validate(LoginUserDto, value), {status: 422});
    }
  });
});
