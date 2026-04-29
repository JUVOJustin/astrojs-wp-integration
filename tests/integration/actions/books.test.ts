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
        { id, force: true },
        { authHeader: basicAuth },
      ).catch(() => undefined);
    }
  });

  it('routes create action to custom post type resource endpoint', async () => {
    const created = await callAction<{ id: number; type: string }>(
      'createBook',
      {
        title: 'Books behavior: action create',
        status: 'draft',
        meta: { test_book_isbn: '978-0-00-000000-1' },
      },
      { authHeader: basicAuth },
    );

    createdIds.push(created.id);
    expect(created.type).toBe('book');
  });

  it('supports custom schema extension for CPT-specific fields', async () => {
    const created = await callAction<{ id: number; type: string }>(
      'createBookCustomSchema',
      {
        title: 'Books behavior: schema extension',
        status: 'draft',
        custom_note: 'typed-input-extension',
      },
      { authHeader: basicAuth },
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
        title: 'Books behavior: response override',
        status: 'draft',
      },
      { authHeader: basicAuth },
    );

    createdIds.push(created.id);
    expect(created.type).toBe('book');
  });

  it('updates CPT content through configured books resource', async () => {
    const created = await callAction<{ id: number }>(
      'createBook',
      {
        title: 'Books behavior: update base',
        status: 'draft',
      },
      { authHeader: basicAuth },
    );
    createdIds.push(created.id);

    const updated = await callAction<{
      type: string;
      title: { rendered: string };
    }>(
      'updateBook',
      {
        id: created.id,
        title: 'Books behavior: updated title',
        custom_note: 'typed-update-extension',
      },
      { authHeader: basicAuth },
    );

    expect(updated.type).toBe('book');
    expect(updated.title.rendered).toBe('Books behavior: updated title');
  });

  it('maps CPT write auth failures to ActionError', async () => {
    await expect(
      callAction('createBook', {
        title: 'Books behavior: unauthorized',
        status: 'draft',
      }),
    ).rejects.toMatchObject({ type: 'AstroActionError' });
  });
});
