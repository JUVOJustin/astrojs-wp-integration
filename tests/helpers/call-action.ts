import type { ActionAPIContext } from 'astro:actions';

const ACTION_API_CONTEXT_SYMBOL = Symbol.for('astro.actionAPIContext');

/**
 * Creates one minimal Astro action API context for integration tests.
 */
export function createActionApiTestContext(request?: Request): ActionAPIContext {
  return {
    request: request ?? new Request('https://example.com/_actions/test', { method: 'POST' }),
    locals: {},
    [ACTION_API_CONTEXT_SYMBOL]: true,
  } as unknown as ActionAPIContext;
}

/**
 * Executes one Astro action client with a valid action API context.
 */
export function callActionOrThrow<TInput, TOutput>(
  action: { orThrow: (this: ActionAPIContext, input: TInput) => Promise<TOutput> },
  input: TInput,
  context?: ActionAPIContext,
): Promise<TOutput> {
  const actionContext = context ?? createActionApiTestContext();

  return action.orThrow.call(actionContext, input);
}
