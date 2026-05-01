/**
 * Schema generation integration test.
 *
 * Verifies that the wp-astrojs-integration catalog hook can successfully
 * resolve and execute the fluent-wp-client CLI to generate typed schema
 * artifacts. This guards against ESM-only package resolution failures such
 * as ERR_PACKAGE_PATH_NOT_EXPORTED.
 *
 * Requires `wp-env` to be running (`npm run wp:start`).
 */

import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { resolveWpBaseUrl } from '../../helpers/wp-env';

const execFileAsync = promisify(execFile);

describe('Schema generation', () => {
  it('resolves the fluent-wp-client CLI without ERR_PACKAGE_PATH_NOT_EXPORTED', async () => {
    // This is the exact resolution pattern used by src/integration.ts.
    const resolved = import.meta.resolve('fluent-wp-client');
    const packageRoot = resolve(dirname(fileURLToPath(resolved)), '..');
    const packageJson = JSON.parse(
      await readFile(join(packageRoot, 'package.json'), 'utf-8'),
    ) as { bin?: { 'fluent-wp-client'?: string } };
    const binPath = packageJson.bin?.['fluent-wp-client'];

    expect(binPath).toBeDefined();

    const cliPath = resolve(packageRoot, binPath!);
    const cliContent = await readFile(cliPath, 'utf-8');

    expect(cliContent).toContain('fluent-wp-client');
  });

  it('generates typed schema artifacts via the fluent-wp-client CLI', async () => {
    const tmpDir = await mkdtemp('/tmp/wp-schema-generation-test-');
    const zodOut = join(tmpDir, 'schemas.mjs');
    const typesOut = join(tmpDir, 'schemas.d.ts');

    try {
      const resolved = import.meta.resolve('fluent-wp-client');
      const packageRoot = resolve(dirname(fileURLToPath(resolved)), '..');
      const packageJson = JSON.parse(
        await readFile(join(packageRoot, 'package.json'), 'utf-8'),
      ) as { bin?: { 'fluent-wp-client'?: string } };
      const cliPath = resolve(
        packageRoot,
        packageJson.bin!['fluent-wp-client']!,
      );

      await execFileAsync(process.execPath, [
        cliPath,
        'schemas',
        '--url',
        resolveWpBaseUrl(),
        '--zod-out',
        zodOut,
        '--types-out',
        typesOut,
      ]);

      const zodModule = await readFile(zodOut, 'utf-8');
      const typesModule = await readFile(typesOut, 'utf-8');

      expect(zodModule).toContain('export const wpPostSchema');
      expect(zodModule).toContain('export const wpPageSchema');
      expect(typesModule).toContain('interface WPPost ');
      expect(typesModule).toContain('interface WPPage ');
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });
});
