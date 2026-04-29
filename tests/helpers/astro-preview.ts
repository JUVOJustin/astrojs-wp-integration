import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { cp, mkdtemp, rm } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'astro';
import { request } from './http-client';

const fixtureRoot = fileURLToPath(
  new URL('../fixtures/astro-site', import.meta.url),
);

type AstroPreviewSession = {
  baseUrl: string;
  stop: () => Promise<void>;
};

/**
 * Waits until the preview server is reachable before test traffic starts.
 */
async function waitForServer(
  baseUrl: string,
  serverProcess: ChildProcessWithoutNullStreams,
): Promise<void> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (serverProcess.exitCode !== null) {
      throw new Error(
        `Astro standalone server exited early with code ${serverProcess.exitCode}.`,
      );
    }

    try {
      const response = await request(baseUrl);

      if (response.ok || response.status === 404) {
        return;
      }
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Timed out waiting for Astro preview server at ${baseUrl}`);
}

/**
 * Reserves one free localhost TCP port for a standalone Astro server process.
 */
async function getAvailablePort(): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const server = net.createServer();

    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();

      if (!address || typeof address === 'string') {
        server.close(() =>
          reject(new Error('Failed to allocate an Astro preview port.')),
        );
        return;
      }

      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(address.port);
      });
    });
  });
}

/**
 * Starts a production-style Astro preview server for route-caching integration tests.
 */
export async function startAstroPreviewServer(): Promise<AstroPreviewSession> {
  const previewRoot = await mkdtemp(
    path.join(path.dirname(fixtureRoot), '.tmp-preview-fixture-'),
  );
  const previousMode = process.env.ASTRO_TEST_MODE;
  const previousRouteCacheFlag = process.env.ASTRO_TEST_ROUTE_CACHE;

  await cp(fixtureRoot, previewRoot, { recursive: true });

  delete process.env.ASTRO_TEST_MODE;
  process.env.ASTRO_TEST_ROUTE_CACHE = '1';

  try {
    await build({
      root: previewRoot,
      logLevel: 'silent',
    });

    const port = await getAvailablePort();
    const entryPath = path.join(previewRoot, 'dist', 'server', 'entry.mjs');
    const serverOutput: string[] = [];
    const server = spawn(process.execPath, [entryPath], {
      cwd: previewRoot,
      env: {
        ...process.env,
        HOST: '127.0.0.1',
        PORT: String(port),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    server.stdout.on('data', (chunk) => {
      serverOutput.push(String(chunk));
    });
    server.stderr.on('data', (chunk) => {
      serverOutput.push(String(chunk));
    });

    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      await waitForServer(baseUrl, server);
    } catch (error) {
      server.kill('SIGTERM');
      const detail = serverOutput.join('');
      throw new Error(
        detail.length > 0
          ? `Failed to start Astro standalone server.\n${detail}`
          : error instanceof Error
            ? error.message
            : 'Failed to start Astro standalone server.',
      );
    }

    return {
      baseUrl,
      stop: async () => {
        if (server.exitCode === null) {
          server.kill('SIGTERM');
          await new Promise<void>((resolve) => {
            server.once('exit', () => resolve());
            setTimeout(() => resolve(), 5_000);
          });
        }

        await rm(previewRoot, { recursive: true, force: true });

        if (previousMode === undefined) {
          delete process.env.ASTRO_TEST_MODE;
        } else {
          process.env.ASTRO_TEST_MODE = previousMode;
        }

        if (previousRouteCacheFlag === undefined) {
          delete process.env.ASTRO_TEST_ROUTE_CACHE;
        } else {
          process.env.ASTRO_TEST_ROUTE_CACHE = previousRouteCacheFlag;
        }
      },
    };
  } catch (error) {
    await rm(previewRoot, { recursive: true, force: true });

    if (previousMode === undefined) {
      delete process.env.ASTRO_TEST_MODE;
    } else {
      process.env.ASTRO_TEST_MODE = previousMode;
    }

    if (previousRouteCacheFlag === undefined) {
      delete process.env.ASTRO_TEST_ROUTE_CACHE;
    } else {
      process.env.ASTRO_TEST_ROUTE_CACHE = previousRouteCacheFlag;
    }

    throw error;
  }
}
