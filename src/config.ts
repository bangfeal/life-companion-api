const levels = [
  'fatal',
  'error',
  'warn',
  'info',
  'debug',
  'trace',
  'silent',
] as const;
export function readConfig(env: NodeJS.ProcessEnv = process.env) {
  const port = Number(env.PORT ?? '3000');
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('PORT must be an integer from 1 to 65535');
  const host = env.HOST ?? '127.0.0.1';
  if (!host.trim()) throw new Error('HOST must not be empty');
  const logLevel = env.LOG_LEVEL ?? 'info';
  if (!levels.some((level) => level === logLevel))
    throw new Error('LOG_LEVEL is invalid');
  return { host, port, logLevel };
}
export function readDatabaseUrl(env: NodeJS.ProcessEnv = process.env) {
  const value = env.DATABASE_URL;
  try {
    if (!value) throw new Error();
    const url = new URL(value);
    if (
      !['postgres:', 'postgresql:'].includes(url.protocol) ||
      !url.hostname ||
      url.pathname.length < 2
    )
      throw new Error();
    return value;
  } catch {
    throw new Error(
      'DATABASE_URL must be a PostgreSQL URL with a host and database name',
    );
  }
}
