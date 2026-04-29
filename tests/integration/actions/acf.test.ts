import { afterAll, describe, expect, it } from 'vitest';
import { callAction } from '../../helpers/action-client';

/**
 * Astro action-layer integration for custom-field behavior.
 *
 * This suite focuses on package behavior: extensible action schemas, forwarding
 * custom ACF-shaped payloads, and ActionError mapping.
 */
describe('Actions: ACF behavior', () => {
  const jwtAuth = `Bearer ${process.env.WP_JWT_TOKEN!}`;

  const createdIds: number[] = [];

  /**
   * Reads normalized ACF data from one action response.
   */
  function getAcf(value: unknown): Record<string, unknown> {
    const acf = (value as { acf?: Record<string, unknown> | null }).acf;

    if (!acf) {
      return {};
    }

    return acf;
  }

  afterAll(async () => {
    for (const id of createdIds) {
      await callAction(
        'deletePost',
        { id, force: true },
        { authHeader: jwtAuth },
      ).catch(() => undefined);
    }
  });

  it('forwards ACF payloads in create and update actions', async () => {
    const created = await callAction<{
      id: number;
      acf?: Record<string, unknown>;
    }>(
      'createPostAcf',
      {
        title: 'ACF behavior: create passthrough',
        status: 'draft',
        acf: {
          acf_subtitle: 'initial subtitle',
          acf_priority_score: 10,
        },
      },
      { authHeader: jwtAuth },
    );

    createdIds.push(created.id);
    expect(getAcf(created).acf_subtitle).toBe('initial subtitle');

    const updated = await callAction<{ acf?: Record<string, unknown> }>(
      'updatePostAcf',
      {
        id: created.id,
        acf: {
          acf_subtitle: 'updated subtitle',
        },
      },
      { authHeader: jwtAuth },
    );

    expect(getAcf(updated).acf_subtitle).toBe('updated subtitle');
    expect(getAcf(updated).acf_priority_score).toBe(10);
  });

  it('supports callback-driven ACF choice labels on successful action responses', async () => {
    const created = await callAction<{
      id: number;
      acf?: Record<string, unknown>;
    }>(
      'createPostAcfMapped',
      {
        title: 'ACF behavior: mapped create response',
        status: 'draft',
        acf: {
          acf_project_status: 'in_progress',
        },
      },
      { authHeader: jwtAuth },
    );

    createdIds.push(created.id);
    expect(getAcf(created).acf_project_status).toBe('In progress');

    const updated = await callAction<{ acf?: Record<string, unknown> }>(
      'updatePostAcfMapped',
      {
        id: created.id,
        acf: {
          acf_project_status: 'done',
        },
      },
      { authHeader: jwtAuth },
    );

    expect(getAcf(updated).acf_project_status).toBe('Done');
  });

  it('maps unauthenticated custom-field writes to ActionError', async () => {
    await expect(
      callAction('createPostAcf', {
        title: 'ACF behavior: unauthorized',
        status: 'draft',
        acf: {
          acf_subtitle: 'no auth',
        },
      }),
    ).rejects.toMatchObject({ type: 'AstroActionError' });
  });
});
