import { ActionError, defineAction, type ActionAPIContext, type ActionClient } from 'astro:actions';
import { z } from 'astro/zod';
import type { WordPressCategory, WordPressClient, WordPressPost } from 'fluent-wp-client';
import {
  createContentInvalidationTags,
  createTermInvalidationTags,
  createUserInvalidationTags,
} from '../../cache/hints';
import {
  resolveRequiredActionClient,
  withActionClient,
  type ResolvableActionClient,
} from '../post/client';
import {
  assertCacheEnabled,
  invalidateCacheBaseSchema,
  invalidateCacheTags,
  resolveContentResource,
  resolveTermResource,
  type CacheInvalidationResult,
} from './shared';

/**
 * Input schema for invalidating one cached WordPress entity.
 */
export const wpCacheInvalidateInputSchema = invalidateCacheBaseSchema.extend({
  entity: z.enum(['post', 'term', 'user']),
  post_type: z.string().min(1).optional(),
  taxonomy: z.string().min(1).optional(),
}).passthrough().superRefine((input, context) => {
  if (input.entity === 'post' && !input.post_type) {
    context.addIssue({
      code: 'custom',
      path: ['post_type'],
      message: '`post_type` is required when `entity` is `post`.',
    });
  }

  if (input.entity === 'term' && !input.taxonomy) {
    context.addIssue({
      code: 'custom',
      path: ['taxonomy'],
      message: '`taxonomy` is required when `entity` is `term`.',
    });
  }

  if (input.entity !== 'post' && input.post_type) {
    context.addIssue({
      code: 'custom',
      path: ['post_type'],
      message: '`post_type` is only valid when `entity` is `post`.',
    });
  }

  if (input.entity !== 'term' && input.taxonomy) {
    context.addIssue({
      code: 'custom',
      path: ['taxonomy'],
      message: '`taxonomy` is only valid when `entity` is `term`.',
    });
  }
});

export type WpCacheInvalidateInput = z.infer<typeof wpCacheInvalidateInputSchema>;

/**
 * Invalidates the cache tags for one WordPress post, term, or user entity.
 */
export async function executeWpCacheInvalidate(
  client: WordPressClient,
  input: WpCacheInvalidateInput,
  context: ActionAPIContext,
): Promise<CacheInvalidationResult> {
  assertCacheEnabled(context);

  if (input.entity === 'post') {
    const postType = input.post_type as string;
    const resource = await resolveContentResource(client, postType);

    return withActionClient(client, async (resolvedClient) => {
      const entry = await resolvedClient.content(resource).item(input.id) as WordPressPost;
      const tags = createContentInvalidationTags(resource, entry.id);

      return invalidateCacheTags(context, resource, tags);
    });
  }

  if (input.entity === 'term') {
    const taxonomy = input.taxonomy as string;
    const resource = await resolveTermResource(client, taxonomy);

    return withActionClient(client, async (resolvedClient) => {
      const entry = await resolvedClient.terms(resource).item(input.id) as WordPressCategory;
      const tags = createTermInvalidationTags(resource, entry);

      return invalidateCacheTags(context, resource, tags);
    });
  }

  return withActionClient(client, async (resolvedClient) => {
    const entry = await resolvedClient.users().item(input.id);

    if (!entry) {
      throw new ActionError({
        code: 'NOT_FOUND',
        message: `WordPress user '${input.id}' was not found.`,
      });
    }

    const tags = createUserInvalidationTags(entry.id);

    return invalidateCacheTags(context, 'users', tags);
  });
}

/**
 * Creates one Astro action that invalidates the cache for a single WordPress entity.
 */
export function createWpCacheInvalidateAction(
  client: ResolvableActionClient,
): ActionClient<CacheInvalidationResult, undefined, typeof wpCacheInvalidateInputSchema> & string {
  return defineAction({
    input: wpCacheInvalidateInputSchema,
    handler: async (input: WpCacheInvalidateInput, context: ActionAPIContext) => {
      const resolvedClient = await resolveRequiredActionClient(client, context);
      return executeWpCacheInvalidate(resolvedClient, input, context);
    },
  }) as ActionClient<CacheInvalidationResult, undefined, typeof wpCacheInvalidateInputSchema> & string;
}
