import {
  WordPressClient,
  type WordPressRequestOptions,
  type WordPressRequestResult,
} from '../../client';
import type {
  WordPressAuthHeaders,
  WordPressAuthHeadersProvider,
  WordPressAuthInput,
} from '../../client/auth';

const WORDPRESS_REST_BASE_SUFFIX = '/wp-json/wp/v2';

/**
 * Shared auth config used by low-level post action execute helpers.
 */
export interface ExecuteActionAuthConfig {
  apiBase: string;
  authHeader?: string;
  auth?: WordPressAuthInput;
  authHeaders?: WordPressAuthHeaders | WordPressAuthHeadersProvider;
}

/**
 * Converts one `apiBase` value into a site base URL accepted by `WordPressClient`.
 */
function getBaseUrlFromApiBase(apiBase: string): string {
  const normalizedApiBase = apiBase.replace(/\/$/, '');

  if (!normalizedApiBase.endsWith(WORDPRESS_REST_BASE_SUFFIX)) {
    throw new Error(`Invalid WordPress apiBase: '${apiBase}'. Expected to end with '${WORDPRESS_REST_BASE_SUFFIX}'.`);
  }

  return normalizedApiBase.slice(0, -WORDPRESS_REST_BASE_SUFFIX.length);
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
    baseUrl: getBaseUrlFromApiBase(config.apiBase),
    auth,
    authHeader,
    authHeaders: config.authHeaders,
  });
}

/**
 * Executes one action request through the shared WordPress client transport.
 */
export async function executeActionRequest<T>(
  config: ExecuteActionAuthConfig,
  options: WordPressRequestOptions,
): Promise<WordPressRequestResult<T>> {
  const client = createActionClient(config);
  return client.request<T>(options);
}
