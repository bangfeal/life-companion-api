import { describe, expect, it } from 'vitest';
import { readConfig, readDatabaseUrl } from '../src/config.js';
describe('configuration', () => {
  it('provides local defaults', () => {
    expect(readConfig({})).toEqual({
      host: '127.0.0.1',
      port: 3000,
      logLevel: 'info',
    });
  });
  it.each(['0', '65536', 'abc', '3.5', ''])(
    'rejects invalid port %s',
    (PORT) => {
      expect(() => readConfig({ PORT })).toThrow('PORT');
    },
  );
  it('rejects invalid log levels', () => {
    expect(() => readConfig({ LOG_LEVEL: 'secret' })).toThrow('LOG_LEVEL');
  });
  it('validates database URLs without exposing credentials', () => {
    expect(
      readDatabaseUrl({ DATABASE_URL: 'postgres://user:pass@localhost/db' }),
    ).toContain('postgres:');
    expect(() =>
      readDatabaseUrl({ DATABASE_URL: 'https://user:secret@host/db' }),
    ).toThrow('DATABASE_URL must be');
    expect(() => readDatabaseUrl({})).toThrow('DATABASE_URL');
  });
});
