import { parse as devalueParse } from 'devalue';
import { request } from './http-client';

/**
 * Resolves the Astro dev server base URL from the env set by globalSetup.
 */
export function getAstroDevUrl(): string {
  return process.env.ASTRO_DEV_URL || 'http://localhost:4321';
}

/**
 * Error class matching ActionError shape for test assertions.
 */
export class ActionError extends Error {
  readonly type = 'AstroActionError' as const;
  readonly code: string;
  readonly status: number;

  constructor(params: { code: string; message?: string; status: number }) {
    super(params.message ?? params.code);
    this.code = params.code;
    this.status = params.status;
  }
}

/**
 * Deserializes one Astro action RPC response into data or throws ActionError.
 */
async function parseActionResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type') ?? '';
  const body = await response.text();

  if (!response.ok) {
    let parsed: { code?: string; message?: string; type?: string };

    try {
      parsed = JSON.parse(body);
    } catch {
      throw new ActionError({
        code: 'INTERNAL_SERVER_ERROR',
        message: body,
        status: response.status,
      });
    }

    throw new ActionError({
      code: parsed.code ?? 'INTERNAL_SERVER_ERROR',
      message: parsed.message ?? `Action failed with status ${response.status}`,
      status: response.status,
    });
  }

  if (contentType.includes('application/json+devalue')) {
    return devalueParse(body, { URL: (href: string) => new URL(href) }) as T;
  }

  return JSON.parse(body) as T;
}

/**
 * Calls one named Astro action through the real dev server RPC endpoint.
 *
 * The action name corresponds to the export key in the fixture's
 * `src/actions/index.ts > server` object (e.g. 'createPost').
 */
export async function callAction<T = unknown>(
  actionName: string,
  input: unknown,
  options?: { authHeader?: string; baseUrl?: string },
): Promise<T> {
  const baseUrl = options?.baseUrl ?? getAstroDevUrl();
  const url = `${baseUrl}/_actions/${actionName}`;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    Origin: baseUrl,
  };

  if (input !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (options?.authHeader) {
    headers['X-Test-Auth'] = options.authHeader;
  }

  const response = await request(url, {
    method: 'POST',
    headers,
    body: input !== undefined ? JSON.stringify(input) : undefined,
  });

  return parseActionResponse<T>(response);
}
