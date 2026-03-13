import { describe, it, expect, afterAll } from 'vitest';
import { callAction } from '../../helpers/action-client';

/**
 * Astro action integration for page-targeted resource behavior.
 */
describe('Actions: Pages', () => {
  const basicAuth = `Basic ${btoa(`admin:${process.env.WP_APP_PASSWORD!}`)}`;

  const createdIds: number[] = [];

  afterAll(async () => {
    for (const id of createdIds) {
      await callAction('deletePage', { id, force: true }, { authHeader: basicAuth }).catch(() => undefined);
    }
  });

  it('routes create action to pages endpoint and returns page response shape', async () => {
    const created = await callAction<{ id: number; type: string; menu_order: number }>('createPage', {
      title: 'Pages behavior: action create',
      status: 'draft',
      parent: 0,
      menu_order: 9,
    }, { authHeader: basicAuth });

    createdIds.push(created.id);
    expect(created.type).toBe('page');
    expect(created.menu_order).toBe(9);
  });

  it('supports custom page input schema extensions in update action', async () => {
    const page = await callAction<{ id: number }>('createPage', {
      title: 'Pages behavior: update schema base',
      status: 'draft',
    }, { authHeader: basicAuth });
    createdIds.push(page.id);

    const updated = await callAction<{ type: string; menu_order: number }>('updatePage', {
      id: page.id,
      menu_order: 21,
      acf: { acf_subtitle: 'page action update' },
    }, { authHeader: basicAuth });

    expect(updated.type).toBe('page');
    expect(updated.menu_order).toBe(21);
  });

  it('supports response schema override for pages actions', async () => {
    const created = await callAction<{ id: number; type: 'page'; status: string }>('createPageResponseOverride', {
      title: 'Pages behavior: response override',
      status: 'draft',
    }, { authHeader: basicAuth });

    createdIds.push(created.id);
    expect(created.type).toBe('page');
  });

  it('maps page write auth failures to ActionError', async () => {
    await expect(
      callAction('createPage', { title: 'Pages behavior: unauthorized', status: 'draft' }),
    ).rejects.toMatchObject({ type: 'AstroActionError' });
  });
});
