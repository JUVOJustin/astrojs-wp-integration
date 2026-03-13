import { describe, it, expect, afterAll } from 'vitest';
import { callAction } from '../../helpers/action-client';

/**
 * Astro action integration for taxonomy term resources.
 */
describe('Actions: Terms', () => {
  const basicAuth = `Basic ${btoa(`admin:${process.env.WP_APP_PASSWORD!}`)}`;

  const createdTerms: Array<{ deleteAction: 'deleteCategory' | 'deleteGenre'; id: number }> = [];

  afterAll(async () => {
    for (const term of createdTerms) {
      await callAction(term.deleteAction, { id: term.id, force: true }, { authHeader: basicAuth })
        .catch(() => undefined);
    }
  });

  it('creates and updates categories through term actions', async () => {
    const created = await callAction<{ id: number; taxonomy: string }>('createCategory', {
      name: 'Action category create',
      slug: 'action-category-create',
      custom_note: 'custom schema field',
    }, { authHeader: basicAuth });

    createdTerms.push({ deleteAction: 'deleteCategory', id: created.id });
    expect(created.taxonomy).toBe('category');

    const updated = await callAction<{ name: string }>('updateCategory', {
      id: created.id,
      name: 'Action category updated',
      custom_note: 'typed update field',
    }, { authHeader: basicAuth });

    expect(updated.name).toBe('Action category updated');
  });

  it('creates and deletes tags through term actions', async () => {
    const created = await callAction<{ id: number; taxonomy: string }>('createTag', {
      name: 'Action tag create',
      slug: 'action-tag-create',
    }, { authHeader: basicAuth });

    expect(created.taxonomy).toBe('post_tag');

    const deleted = await callAction<{ deleted: boolean }>('deleteTag', {
      id: created.id,
      force: true,
    }, { authHeader: basicAuth });

    expect(deleted.deleted).toBe(true);
  });

  it('supports custom taxonomy resources with response schema override', async () => {
    const created = await callAction<{ id: number; taxonomy: 'genre'; name: string }>('createGenre', {
      name: 'Action genre create',
      slug: 'action-genre-create',
    }, { authHeader: basicAuth });

    createdTerms.push({ deleteAction: 'deleteGenre', id: created.id });
    expect(created.taxonomy).toBe('genre');
  });

  it('maps term write auth failures to ActionError', async () => {
    await expect(
      callAction('createCategory', { name: 'Unauthorized term create' }),
    ).rejects.toMatchObject({ type: 'AstroActionError' });
  });
});
