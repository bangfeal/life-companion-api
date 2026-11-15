import { format } from 'prettier';
import { writeFile } from 'node:fs/promises';
import { buildApp } from '../src/app.js';
const app = await buildApp();
try {
  await app.ready();
  await writeFile(
    'openapi.json',
    await format(JSON.stringify(app.swagger()), { parser: 'json' }),
  );
} finally {
  await app.close();
}
