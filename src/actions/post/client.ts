import { type ActionAPIContext, ActionError } from 'astro:actions';
import { type WordPressClient, WordPressHttpError } from 'fluent-wp-client';

type MaybePromise<T> = T | Promise<T>;

/**
 * Callback shape used when one Astro action needs a request-scoped WordPress client.
 */
export type ActionClientResolver = (
  context: ActionAPIContext,
) => MaybePromise<WordPressClient | null | undefined>;

/**
 * Client source accepted by action factories.
 */
export type ResolvableActionClient = WordPressClient | ActionClientResolver;

/**
 * Callback shape for rewriting successful action responses before returning them to Astro.
 */
export type ActionResponseMapper<TResponse = unknown, TInput = unknown> = (
  response: TResponse,
  context: {
    client: WordPressClient;
    input: TInput;
    operation: 'create' | 'update';
    resource: string;
  },
) => TResponse | Promise<TResponse>;

/**
 * Resolves one reusable WordPress client from either a static instance or one request-aware resolver.
 */
export async function resolveActionClient(
  client: ResolvableActionClient,
  context: ActionAPIContext,
): Promise<WordPressClient | null> {
  if (typeof client === 'function') {
    return (await client(context)) ?? null;
  }

  return client ?? null;
}

/**
 * Resolves one required WordPress client or throws an ActionError when no client is available.
 */
export async function resolveRequiredActionClient(
  client: ResolvableActionClient,
  context: ActionAPIContext,
): Promise<WordPressClient> {
  const resolvedClient = await resolveActionClient(client, context);

  if (resolvedClient) {
    return resolvedClient;
  }

  throw new ActionError({
    code: 'UNAUTHORIZED',
    message: 'Authentication is required to execute this action.',
  });
}

/**
 * Executes one callback with a configured client and normalizes thrown errors.
 */
export async function withActionClient<T>(
  client: WordPressClient,
  callback: (client: WordPressClient) => Promise<T>,
): Promise<T> {
  try {
    return await callback(client);
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

  if (error instanceof WordPressHttpError) {
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
