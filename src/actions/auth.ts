import { ActionError, type ActionAPIContext } from 'astro/actions/runtime/server.js';
import {
  createWordPressAuthHeader,
  resolveWordPressAuth,
  type ResolvableWordPressAuth,
} from '../client/auth';

/**
 * Context-aware authentication input accepted by action factories.
 */
export type ActionAuthConfig = ResolvableWordPressAuth<ActionAPIContext>;

/**
 * Resolves the request-scoped Authorization header used by write actions.
 */
export async function resolveActionAuthHeader(
  auth: ActionAuthConfig,
  context: ActionAPIContext,
): Promise<string> {
  const resolvedAuth = await resolveWordPressAuth(auth, context);

  if (!resolvedAuth) {
    throw new ActionError({
      code: 'UNAUTHORIZED',
      message: 'Authentication is required to execute this action.',
    });
  }

  return createWordPressAuthHeader(resolvedAuth);
}
