import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {EnvironmentError, validateEnvironment} from '../src/config/environment';

describe('Environment configuration', () => {
  it('provides local defaults and parses configured ports and origins', () => {
    const defaults = validateEnvironment({});
    assert.equal(defaults.APP_PORT, 3000);
    assert.equal(defaults.APP_HOST, '127.0.0.1');
    const custom = validateEnvironment({
      APP_PORT: '4000',
      APP_HOST: '0.0.0.0',
      CORS_ORIGINS: 'http://localhost:5173, https://example.com',
    });
    assert.equal(custom.APP_PORT, 4000);
    assert.deepEqual(custom.CORS_ORIGINS, [
      'http://localhost:5173',
      'https://example.com',
    ]);
  });

  it('rejects invalid ports, empty hosts and invalid browser origins', () => {
    for (const port of ['', 'bad', '3000x', 0, -1, 65536, 1.5]) {
      assert.throws(
        () => validateEnvironment({APP_PORT: port}),
        EnvironmentError,
      );
    }
    assert.throws(() => validateEnvironment({APP_HOST: ' '}), EnvironmentError);
    for (const origins of [
      '',
      '*',
      'ftp://example.com',
      'https://example.com/path',
    ]) {
      assert.throws(
        () => validateEnvironment({CORS_ORIGINS: origins}),
        EnvironmentError,
      );
    }
  });
});
