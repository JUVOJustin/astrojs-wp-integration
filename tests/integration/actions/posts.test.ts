import { describe, it, expect, afterAll } from 'vitest';
import { ActionError } from 'astro/actions/runtime/server.js';
import { z } from 'astro/zod';
import {
  createCreatePostAction,
  createUpdatePostAction,
  createDeletePostAction,
  createPostInputSchema,
  updatePostInputSchema,
  executeCreatePost,
  executeDeletePost,
} from '../../../src/actions';
import { createJwtAuthHeader } from 'fluent-wp-client';
import { resolveActionRequestAuth } from '../../../src/actions/auth';
import { createActionBaseConfig, getBaseUrl } from '../../helpers/wp-client';

/**
 * Integration tests for Astro post action behavior.
 *
 * These tests focus on action-layer concerns: schema customization,
 * request-context auth resolution, and typed response overrides.
 */
describe('Actions: Posts', () => {
  const baseUrl = getBaseUrl();
  const actionBaseConfig = createActionBaseConfig();

  const jwtAuthConfig = {
    ...actionBaseConfig,
    authHeader: createJwtAuthHeader(process.env.WP_JWT_TOKEN!),
  };

  const anonConfig = {
    ...actionBaseConfig,
    authHeader: '',
  };

  const createdIds: number[] = [];

  afterAll(async () => {
    for (const id of createdIds) {
      await executeDeletePost(jwtAuthConfig, { id, force: true }).catch(() => {
        return;
      });
    }
  });

  it('supports custom input schema in create action factory', async () => {
    const createAction = createCreatePostAction({
      baseUrl,
      auth: { token: process.env.WP_JWT_TOKEN! },
      schema: createPostInputSchema.extend({
        acf: z.object({
          acf_subtitle: z.string().optional(),
        }).optional(),
      }),
    });

    const created = await createAction.orThrow({
      title: 'Action behavior: custom schema create',
      status: 'draft',
      acf: {
        acf_subtitle: 'from create action schema',
      },
    } as never);

    createdIds.push(created.id);
    expect(created.id).toBeGreaterThan(0);
  });

  it('supports custom input schema in update action factory', async () => {
    const created = await executeCreatePost(jwtAuthConfig, {
      title: 'Action behavior: custom schema update base',
      status: 'draft',
    });
    createdIds.push(created.id);

    const updateAction = createUpdatePostAction({
      baseUrl,
      auth: { token: process.env.WP_JWT_TOKEN! },
      schema: updatePostInputSchema.extend({
        acf: z.object({
          acf_subtitle: z.string().optional(),
        }).optional(),
      }),
    });

    const updated = await updateAction.orThrow({
      id: created.id,
      title: 'Action behavior: custom schema updated',
      acf: {
        acf_subtitle: 'from update action schema',
      },
    } as never);

    expect(updated.title.rendered).toBe('Action behavior: custom schema updated');
  });

  it('resolves request-context auth through action auth helpers', async () => {
    const auth = await resolveActionRequestAuth(
      {
        auth: ({ request }) => request.headers.get('authorization'),
      },
      {
        request: new Request('https://example.com/actions', {
          method: 'POST',
          headers: {
            Authorization: createJwtAuthHeader(process.env.WP_JWT_TOKEN!),
          },
        }),
      } as never,
    );

    expect(auth.auth).toBe(createJwtAuthHeader(process.env.WP_JWT_TOKEN!));
  });

  it('supports response schema override for create action', async () => {
    const createAction = createCreatePostAction({
      baseUrl,
      auth: { token: process.env.WP_JWT_TOKEN! },
      responseSchema: z.object({
        id: z.number().int().positive(),
        status: z.string(),
      }),
    });

    const created = await createAction.orThrow({
      title: 'Action behavior: response schema override',
      status: 'draft',
    } as never);

    createdIds.push(created.id);
    expect(created.status).toBe('draft');
  });

  it('returns ActionError for unauthenticated action execution', async () => {
    await expect(
      resolveActionRequestAuth(
        {
          auth: ({ request }) => request.headers.get('authorization'),
        },
        {
          request: new Request('https://example.com/actions', { method: 'POST' }),
        } as never,
      ),
    ).rejects.toThrow(ActionError);

    await expect(
      executeCreatePost(anonConfig, { title: 'Action behavior: anon execute', status: 'draft' }),
    ).rejects.toThrow(ActionError);
  });

  it('supports delete action factory for trash and force delete flows', async () => {
    const createAction = createCreatePostAction({
      baseUrl,
      auth: { token: process.env.WP_JWT_TOKEN! },
    });

    const deleteAction = createDeletePostAction({
      baseUrl,
      auth: { token: process.env.WP_JWT_TOKEN! },
    });

    const trashedCandidate = await createAction.orThrow({
      title: 'Action behavior: trash flow',
      status: 'draft',
    } as never);

    const trashed = await deleteAction.orThrow({ id: trashedCandidate.id } as never);
    expect(trashed.deleted).toBe(false);

    const forceCandidate = await createAction.orThrow({
      title: 'Action behavior: force delete flow',
      status: 'draft',
    } as never);

    const forceDeleted = await deleteAction.orThrow({ id: forceCandidate.id, force: true } as never);
    expect(forceDeleted.deleted).toBe(true);
  });
});
