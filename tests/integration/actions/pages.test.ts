import { afterAll, describe, expect, it } from 'vitest';

import { callAction } from '../../helpers/action-client';

/**
 * Astro action integration for page-targeted resource behavior.
 */
describe('Actions: Pages', () => {
  const basicAuth = `Basic ${btoa(`admin:${process.env.WP_APP_PASSWORD!}`)}`;

  const createdIds: number[] = [];

  afterAll(async () => {
    for (const id of createdIds) {
      await callAction(
        'deletePage',
        { force: true, id },
        { authHeader: basicAuth }
      ).catch(() => {});
    }
  });

  it('routes create action to pages endpoint and returns page response shape', async () => {
    const created = await callAction<{
      id: number;
      type: string;
      menu_order: number;
    }>(
      'createPage',
      {
        menu_order: 9,
        parent: 0,
        status: 'draft',
        title: 'Pages behavior: action create',
      },
      { authHeader: basicAuth }
    );

    createdIds.push(created.id);
    expect(created.type).toBe('page');
    expect(created.menu_order).toBe(9);
  });

  it('accepts one preconfigured WordPress client directly in the action factory', async () => {
    const created = await callAction<{ id: number; type: string }>(
      'createPageWithStaticClient',
      {
        status: 'draft',
        title: 'Pages behavior: static client create',
      }
    );

    createdIds.push(created.id);
    expect(created.type).toBe('page');
  });

  it('supports custom page input schema extensions in update action', async () => {
    const page = await callAction<{ id: number }>(
      'createPage',
      {
        status: 'draft',
        title: 'Pages behavior: update schema base',
      },
      { authHeader: basicAuth }
    );

    createdIds.push(page.id);

    const updated = await callAction<{ type: string; menu_order: number }>(
      'updatePage',
      {
        acf: { acf_subtitle: 'page action update' },
        id: page.id,
        menu_order: 21,
      },
      { authHeader: basicAuth }
    );

    expect(updated.type).toBe('page');
    expect(updated.menu_order).toBe(21);
  });

  it('supports response schema override for pages actions', async () => {
    const created = await callAction<{
      id: number;
      type: 'page';
      status: string;
    }>(
      'createPageResponseOverride',
      {
        status: 'draft',
        title: 'Pages behavior: response override',
      },
      { authHeader: basicAuth }
    );

    createdIds.push(created.id);
    expect(created.type).toBe('page');
  });

  it('maps page write auth failures to ActionError', async () => {
    await expect(
      callAction('createPage', {
        status: 'draft',
        title: 'Pages behavior: unauthorized',
      })
    ).rejects.toMatchObject({ type: 'AstroActionError' });
  });
});
