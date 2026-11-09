import { afterAll, describe, expect, it } from 'vitest';

import { callAction } from '../../helpers/action-client';

/**
 * Astro action-layer integration for custom-field behavior.
 *
 * This suite focuses on package behavior: extensible action schemas, forwarding
 * custom ACF-shaped payloads, and ActionError mapping.
 */
// oxlint-disable-next-line anti-slop/no-unsafe-dictionary-type -- Registered fixture fields vary by resource; scenarios assert their values.
type FixtureFields = Record<string, unknown>;

describe('Actions: ACF behavior', () => {
  const jwtAuth = `Bearer ${process.env.WP_JWT_TOKEN!}`;

  const createdIds: number[] = [];

  /**
   * Reads normalized ACF data from one action response.
   */
  function getAcf(value: { acf?: FixtureFields | null }): FixtureFields {
    const { acf } = value;

    if (!acf) {
      return {};
    }

    return acf;
  }

  afterAll(async () => {
    for (const id of createdIds) {
      await callAction(
        'deletePost',
        { force: true, id },
        { authHeader: jwtAuth }
      ).catch(() => {});
    }
  });

  it('forwards ACF payloads in create and update actions', async () => {
    const created = await callAction<{
      id: number;
      acf?: FixtureFields;
    }>(
      'createPostAcf',
      {
        acf: {
          acf_priority_score: 10,
          acf_subtitle: 'initial subtitle',
        },
        status: 'draft',
        title: 'ACF behavior: create passthrough',
      },
      { authHeader: jwtAuth }
    );

    createdIds.push(created.id);
    expect(getAcf(created).acf_subtitle).toBe('initial subtitle');

    const updated = await callAction<{ acf?: FixtureFields }>(
      'updatePostAcf',
      {
        acf: {
          acf_subtitle: 'updated subtitle',
        },
        id: created.id,
      },
      { authHeader: jwtAuth }
    );

    expect(getAcf(updated).acf_subtitle).toBe('updated subtitle');
    expect(getAcf(updated).acf_priority_score).toBe(10);
  });

  it('supports callback-driven ACF choice labels on successful action responses', async () => {
    const created = await callAction<{
      id: number;
      acf?: FixtureFields;
    }>(
      'createPostAcfMapped',
      {
        acf: {
          acf_project_status: 'in_progress',
        },
        status: 'draft',
        title: 'ACF behavior: mapped create response',
      },
      { authHeader: jwtAuth }
    );

    createdIds.push(created.id);
    expect(getAcf(created).acf_project_status).toBe('In progress');

    const updated = await callAction<{ acf?: FixtureFields }>(
      'updatePostAcfMapped',
      {
        acf: {
          acf_project_status: 'done',
        },
        id: created.id,
      },
      { authHeader: jwtAuth }
    );

    expect(getAcf(updated).acf_project_status).toBe('Done');
  });

  it('maps unauthenticated custom-field writes to ActionError', async () => {
    await expect(
      callAction('createPostAcf', {
        acf: {
          acf_subtitle: 'no auth',
        },
        status: 'draft',
        title: 'ACF behavior: unauthorized',
      })
    ).rejects.toMatchObject({ type: 'AstroActionError' });
  });
});
