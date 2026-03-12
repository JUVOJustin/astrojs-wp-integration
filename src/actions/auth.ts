import { ActionError, type ActionAPIContext } from 'astro:actions';
import {
  resolveWordPressAuth,
  type ResolvableWordPressAuth,
  type WordPressAuthHeaders,
  type WordPressAuthHeadersProvider,
  type WordPressAuthInput,
} from 'fluent-wp-client';

/**
 * Context-aware authentication input accepted by action factories.
 */
export type ActionAuthConfig = ResolvableWordPressAuth<ActionAPIContext>;

/**
 * Request-aware auth headers accepted by action factories.
 */
export type ActionAuthHeadersConfig = WordPressAuthHeaders | WordPressAuthHeadersProvider;

/**
 * Context resolver for advanced request-aware auth headers.
 */
export interface ActionAuthHeadersFromContext {
  fromContext: (
    context: ActionAPIContext
  ) => ActionAuthHeadersConfig | null | undefined | Promise<ActionAuthHeadersConfig | null | undefined>;
}

/**
 * Auth headers value that can be static or resolved from action context.
 */
export type ResolvableActionAuthHeaders = ActionAuthHeadersConfig | ActionAuthHeadersFromContext;

/**
 * Resolved auth payload passed into execute helpers.
 */
export interface ResolvedActionRequestAuth {
  auth?: WordPressAuthInput;
  authHeaders?: ActionAuthHeadersConfig;
}

/**
 * Checks whether auth headers config uses context-aware resolution.
 */
function isActionAuthHeadersFromContext(
  authHeaders: ResolvableActionAuthHeaders
): authHeaders is ActionAuthHeadersFromContext {
  return typeof authHeaders === 'object' && authHeaders !== null && 'fromContext' in authHeaders;
}

/**
 * Resolves optional advanced auth headers from static or context-aware config.
 */
async function resolveActionAuthHeaders(
  authHeaders: ResolvableActionAuthHeaders | undefined,
  context: ActionAPIContext,
): Promise<ActionAuthHeadersConfig | null> {
  if (!authHeaders) {
    return null;
  }

  if (!isActionAuthHeadersFromContext(authHeaders)) {
    return authHeaders;
  }

  const resolvedAuthHeaders = await authHeaders.fromContext(context);

  if (!resolvedAuthHeaders) {
    return null;
  }

  return resolvedAuthHeaders;
}

/**
 * Resolves action auth config and enforces that at least one auth strategy is present.
 */
export async function resolveActionRequestAuth(
  config: {
    auth?: ActionAuthConfig;
    authHeaders?: ResolvableActionAuthHeaders;
  },
  context: ActionAPIContext,
): Promise<ResolvedActionRequestAuth> {
  const resolvedAuth = config.auth
    ? await resolveWordPressAuth(config.auth, context)
    : null;

  const resolvedAuthHeaders = await resolveActionAuthHeaders(config.authHeaders, context);

  if (!resolvedAuth && !resolvedAuthHeaders) {
    throw new ActionError({
      code: 'UNAUTHORIZED',
      message: 'Authentication is required to execute this action.',
    });
  }

  return {
    auth: resolvedAuth ?? undefined,
    authHeaders: resolvedAuthHeaders ?? undefined,
  };
}
