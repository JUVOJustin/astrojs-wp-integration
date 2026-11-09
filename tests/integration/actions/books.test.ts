import { afterAll, describe, expect, it } from 'vitest';

import { callAction } from '../../helpers/action-client';

/**
 * Astro action integration for custom post type resource behavior.
 */
describe('Actions: Books', () => {
  const basicAuth = `Basic ${btoa(`admin:${process.env.WP_APP_PASSWORD!}`)}`;

  const createdIds: number[] = [];

  afterAll(async () => {
    for (const id of createdIds) {
      await callAction(
        'deleteBook',
        { force: true, id },
        { authHeader: basicAuth }
      ).catch(() => {});
    }
  });

  it('routes create action to custom post type resource endpoint', async () => {
    const created = await callAction<{ id: number; type: string }>(
      'createBook',
      {
        meta: { test_book_isbn: '978-0-00-000000-1' },
        status: 'draft',
        title: 'Books behavior: action create',
      },
      { authHeader: basicAuth }
    );

    createdIds.push(created.id);
    expect(created.type).toBe('book');
  });

  it('supports custom schema extension for CPT-specific fields', async () => {
    const created = await callAction<{ id: number; type: string }>(
      'createBookCustomSchema',
      {
        custom_note: 'typed-input-extension',
        status: 'draft',
        title: 'Books behavior: schema extension',
      },
      { authHeader: basicAuth }
    );

    createdIds.push(created.id);
    expect(created.type).toBe('book');
  });

  it('supports response schema override for CPT action responses', async () => {
    const created = await callAction<{
      id: number;
      type: 'book';
      status: string;
    }>(
      'createBookResponseOverride',
      {
        status: 'draft',
        title: 'Books behavior: response override',
      },
      { authHeader: basicAuth }
    );

    createdIds.push(created.id);
    expect(created.type).toBe('book');
  });

  it('updates CPT content through configured books resource', async () => {
    const created = await callAction<{ id: number }>(
      'createBook',
      {
        status: 'draft',
        title: 'Books behavior: update base',
      },
      { authHeader: basicAuth }
    );

    createdIds.push(created.id);

    const updated = await callAction<{
      type: string;
      title: { rendered: string };
    }>(
      'updateBook',
      {
        custom_note: 'typed-update-extension',
        id: created.id,
        title: 'Books behavior: updated title',
      },
      { authHeader: basicAuth }
    );

    expect(updated.type).toBe('book');
    expect(updated.title.rendered).toBe('Books behavior: updated title');
  });

  it('maps CPT write auth failures to ActionError', async () => {
    await expect(
      callAction('createBook', {
        status: 'draft',
        title: 'Books behavior: unauthorized',
      })
    ).rejects.toMatchObject({ type: 'AstroActionError' });
  });
});
