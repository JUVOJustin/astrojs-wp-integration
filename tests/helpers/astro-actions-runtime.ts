import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const astroPackageRoot = dirname(require.resolve('astro/package.json'));

const getErrorCode = (error: unknown): string | undefined => {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined;
  }

  const { code } = error as { code?: unknown };
  return typeof code === 'string' ? code : undefined;
};

const importAstroRuntimeModule = async (specifier: string, fallbackPath: string) => {
  try {
    return await import(specifier);
  } catch (error) {
    const errorCode = getErrorCode(error);

    if (
      errorCode !== 'ERR_MODULE_NOT_FOUND' &&
      errorCode !== 'ERR_PACKAGE_PATH_NOT_EXPORTED'
    ) {
      throw error;
    }

    const fallbackUrl = pathToFileURL(join(astroPackageRoot, fallbackPath)).href;
    return import(fallbackUrl);
  }
};

const [serverRuntime, clientRuntime] = await Promise.all([
  importAstroRuntimeModule('astro/actions/runtime/server.js', 'dist/actions/runtime/server.js'),
  importAstroRuntimeModule('astro/actions/runtime/client.js', 'dist/actions/runtime/client.js'),
]);

export const defineAction = serverRuntime.defineAction;
export const getActionContext = serverRuntime.getActionContext;
export const ActionError = clientRuntime.ActionError;
export const ActionInputError = clientRuntime.ActionInputError;
export const isActionError = clientRuntime.isActionError;
export const isInputError = clientRuntime.isInputError;
