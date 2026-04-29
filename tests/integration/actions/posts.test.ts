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
        { id, force: true },
        { authHeader: jwtAuth },
      ).catch(() => undefined);
    }
  });

  it('supports custom input schema in create action factory', async () => {
    const created = await callAction<{ id: number }>(
      'createPostCustomSchema',
      {
        title: 'Action behavior: custom schema create',
        status: 'draft',
        acf: { acf_subtitle: 'from create action schema' },
      },
      { authHeader: jwtAuth },
    );

    createdIds.push(created.id);
    expect(created.id).toBeGreaterThan(0);
  });

  it('supports request-aware client resolvers in create action factories', async () => {
    const created = await callAction<{ id: number }>(
      'createPostWithBridgeClient',
      {
        title: 'Action behavior: bridge client create',
        status: 'draft',
      },
      { authHeader: jwtAuth },
    );

    createdIds.push(created.id);
    expect(created.id).toBeGreaterThan(0);
  });

  it('supports custom input schema in update action factory', async () => {
    const created = await callAction<{ id: number }>(
      'createPost',
      {
        title: 'Action behavior: custom schema update base',
        status: 'draft',
      },
      { authHeader: jwtAuth },
    );
    createdIds.push(created.id);

    const updated = await callAction<{ title: { rendered: string } }>(
      'updatePostCustomSchema',
      {
        id: created.id,
        title: 'Action behavior: custom schema updated',
        acf: { acf_subtitle: 'from update action schema' },
      },
      { authHeader: jwtAuth },
    );

    expect(updated.title.rendered).toBe(
      'Action behavior: custom schema updated',
    );
  });

  it('supports response schema override for create action', async () => {
    const created = await callAction<{ id: number; status: string }>(
      'createPostResponseOverride',
      {
        title: 'Action behavior: response schema override',
        status: 'draft',
      },
      { authHeader: jwtAuth },
    );

    createdIds.push(created.id);
    expect(created.status).toBe('draft');
  });

  it('returns ActionError for unauthenticated action execution', async () => {
    await expect(
      callAction('createPost', {
        title: 'Action behavior: anon execute',
        status: 'draft',
      }),
    ).rejects.toThrow(ActionError);
  });

  it('supports delete action factory for trash and force delete flows', async () => {
    const trashedCandidate = await callAction<{ id: number }>(
      'createPost',
      {
        title: 'Action behavior: trash flow',
        status: 'draft',
      },
      { authHeader: jwtAuth },
    );

    const trashed = await callAction<{ deleted: boolean }>(
      'deletePost',
      {
        id: trashedCandidate.id,
      },
      { authHeader: jwtAuth },
    );
    expect(trashed.deleted).toBe(false);

    const forceCandidate = await callAction<{ id: number }>(
      'createPost',
      {
        title: 'Action behavior: force delete flow',
        status: 'draft',
      },
      { authHeader: jwtAuth },
    );

    const forceDeleted = await callAction<{ deleted: boolean }>(
      'deletePost',
      {
        id: forceCandidate.id,
        force: true,
      },
      { authHeader: jwtAuth },
    );
    expect(forceDeleted.deleted).toBe(true);
  });
});
