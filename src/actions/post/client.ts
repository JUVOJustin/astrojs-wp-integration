import {
  WordPressApiError,
  WordPressClient,
  type WordPressClientConfig,
} from 'fluent-wp-client';
import { ActionError } from 'astro/actions/runtime/server.js';
import type {
  WordPressAuthHeaders,
  WordPressAuthHeadersProvider,
  WordPressAuthInput,
} from 'fluent-wp-client';

/**
 * Shared auth config used by low-level post action execute helpers.
 */
export interface ExecuteActionAuthConfig extends Pick<
  WordPressClientConfig,
  'baseUrl' | 'authHeaders' | 'cookies' | 'credentials'
> {
  auth?: WordPressAuthInput;
  authHeader?: string;
  authHeaders?: WordPressAuthHeaders | WordPressAuthHeadersProvider;
}

/**
 * Builds one configured WordPress client for execute helpers.
 */
function createActionClient(config: ExecuteActionAuthConfig): WordPressClient {
  const auth = typeof config.auth === 'string'
    ? undefined
    : config.auth;
  const authHeader = config.authHeader ?? (typeof config.auth === 'string' ? config.auth : undefined);

  return new WordPressClient({
    baseUrl: config.baseUrl,
    auth,
    authHeader,
    authHeaders: config.authHeaders,
    cookies: config.cookies,
    credentials: config.credentials,
  });
}

/**
 * Executes one callback with a configured client and normalizes thrown errors.
 */
export async function withActionClient<T>(
  config: ExecuteActionAuthConfig,
  callback: (client: WordPressClient) => Promise<T>,
): Promise<T> {
  try {
    return await callback(createActionClient(config));
  } catch (error) {
    throw toActionError(error);
  }
}

/**
 * Maps one client-side API error to the Astro action error contract.
 */
export function toActionError(error: unknown): ActionError {
  if (error instanceof ActionError) {
    return error;
  }

  if (error instanceof WordPressApiError) {
    return new ActionError({
      code: ActionError.statusToCode(error.status),
      message: error.message,
    });
  }

  if (error instanceof Error) {
    return new ActionError({
      code: 'INTERNAL_SERVER_ERROR',
      message: error.message,
    });
  }

  return new ActionError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Unexpected WordPress action error.',
  });
}
