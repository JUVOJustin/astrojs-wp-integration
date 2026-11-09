import { afterAll, describe, expect, it } from 'vitest';

import { ActionError, callAction } from '../../helpers/action-client';

/**
 * Integration tests for Astro post actions through the real Astro dev server.
 *
 * Actions are called via HTTP POST to the /_actions/* RPC endpoints,
 * exercising the full Astro action pipeline: routing, input validation,
 * handler execution, and devalue-serialized responses.
 */
describe('Actions: Posts', () => {
  const jwtAuth = `Bearer ${process.env.WP_JWT_TOKEN!}`;

  const createdIds: number[] = [];

  afterAll(async () => {
    for (const id of createdIds) {
      await callAction(
        'deletePost',
        { force: true, id },
        { authHeader: jwtAuth }
      ).catch(() => {});
    }
  });

  it('supports custom input schema in create action factory', async () => {
    const created = await callAction<{ id: number }>(
      'createPostCustomSchema',
      {
        acf: { acf_subtitle: 'from create action schema' },
        status: 'draft',
        title: 'Action behavior: custom schema create',
      },
      { authHeader: jwtAuth }
    );

    createdIds.push(created.id);
    expect(created.id).toBeGreaterThan(0);
  });

  it('supports request-aware client resolvers in create action factories', async () => {
    const created = await callAction<{ id: number }>(
      'createPostWithBridgeClient',
      {
        status: 'draft',
        title: 'Action behavior: bridge client create',
      },
      { authHeader: jwtAuth }
    );

    createdIds.push(created.id);
    expect(created.id).toBeGreaterThan(0);
  });

  it('supports custom input schema in update action factory', async () => {
    const created = await callAction<{ id: number }>(
      'createPost',
      {
        status: 'draft',
        title: 'Action behavior: custom schema update base',
      },
      { authHeader: jwtAuth }
    );

    createdIds.push(created.id);

    const updated = await callAction<{ title: { rendered: string } }>(
      'updatePostCustomSchema',
      {
        acf: { acf_subtitle: 'from update action schema' },
        id: created.id,
        title: 'Action behavior: custom schema updated',
      },
      { authHeader: jwtAuth }
    );

    expect(updated.title.rendered).toBe(
      'Action behavior: custom schema updated'
    );
  });

  it('supports response schema override for create action', async () => {
    const created = await callAction<{ id: number; status: string }>(
      'createPostResponseOverride',
      {
        status: 'draft',
        title: 'Action behavior: response schema override',
      },
      { authHeader: jwtAuth }
    );

    createdIds.push(created.id);
    expect(created.status).toBe('draft');
  });

  it('returns ActionError for unauthenticated action execution', async () => {
    await expect(
      callAction('createPost', {
        status: 'draft',
        title: 'Action behavior: anon execute',
      })
    ).rejects.toThrow(ActionError);
  });

  it('supports delete action factory for trash and force delete flows', async () => {
    const trashedCandidate = await callAction<{ id: number }>(
      'createPost',
      {
        status: 'draft',
        title: 'Action behavior: trash flow',
      },
      { authHeader: jwtAuth }
    );

    const trashed = await callAction<{ deleted: boolean }>(
      'deletePost',
      {
        id: trashedCandidate.id,
      },
      { authHeader: jwtAuth }
    );

    expect(trashed.deleted).toBeFalsy();

    const forceCandidate = await callAction<{ id: number }>(
      'createPost',
      {
        status: 'draft',
        title: 'Action behavior: force delete flow',
      },
      { authHeader: jwtAuth }
    );

    const forceDeleted = await callAction<{ deleted: boolean }>(
      'deletePost',
      {
        force: true,
        id: forceCandidate.id,
      },
      { authHeader: jwtAuth }
    );

    expect(forceDeleted.deleted).toBeTruthy();
  });
});
