import { afterAll, describe, expect, it } from 'vitest';

import { callAction } from '../../helpers/action-client';

/**
 * Astro action-layer integration for meta passthrough behavior.
 *
 * This suite intentionally avoids exhaustive WordPress meta semantics that are
 * already covered in `fluent-wp-client`. It focuses on package behavior:
 * resource routing, schema override wiring, and action-style error mapping.
 */
// oxlint-disable-next-line anti-slop/no-unsafe-dictionary-type -- Registered fixture fields vary by resource; scenarios assert their values.
type FixtureFields = Record<string, unknown>;

describe('Actions: Meta behavior', () => {
  const basicAuth = `Basic ${btoa(`admin:${process.env.WP_APP_PASSWORD!}`)}`;

  const createdIds: {
    deleteAction: 'deletePost' | 'deletePage' | 'deleteBook';
    id: number;
  }[] = [];

  /**
   * Stores one created entity so suite cleanup can remove it.
   */
  function trackCreated(
    deleteAction: 'deletePost' | 'deletePage' | 'deleteBook',
    id: number
  ): void {
    createdIds.push({ deleteAction, id });
  }

  /**
   * Reads normalized REST meta from one action response.
   */
  function getMeta(entry: { meta?: FixtureFields | unknown[] }): FixtureFields {
    const value = entry.meta;

    if (!value || Array.isArray(value)) {
      return {};
    }

    return value;
  }

  afterAll(async () => {
    for (const created of createdIds) {
      await callAction(
        created.deleteAction,
        { force: true, id: created.id },
        { authHeader: basicAuth }
      ).catch(() => {});
    }
  });

  it('passes meta payloads through post, page, and CPT resources', async () => {
    const post = await callAction<{
      id: number;
      meta?: FixtureFields;
    }>(
      'createPost',
      {
        meta: {
          test_number_meta: 12.5,
          test_string_meta: 'post-value',
        },
        status: 'draft',
        title: 'Meta behavior: post passthrough',
      },
      { authHeader: basicAuth }
    );

    trackCreated('deletePost', post.id);

    const page = await callAction<{
      id: number;
      meta?: FixtureFields;
    }>(
      'createPage',
      {
        meta: {
          test_string_meta: 'page-value',
        },
        status: 'draft',
        title: 'Meta behavior: page passthrough',
      },
      { authHeader: basicAuth }
    );

    trackCreated('deletePage', page.id);

    const book = await callAction<{
      id: number;
      meta?: FixtureFields;
    }>(
      'createBook',
      {
        meta: {
          test_book_isbn: '978-1-23-456789-0',
          test_string_meta: 'book-value',
        },
        status: 'draft',
        title: 'Meta behavior: book passthrough',
      },
      { authHeader: basicAuth }
    );

    trackCreated('deleteBook', book.id);

    expect(getMeta(post).test_string_meta).toBe('post-value');
    expect(getMeta(page).test_string_meta).toBe('page-value');
    expect(getMeta(book).test_book_isbn).toBe('978-1-23-456789-0');
  });

  it('supports partial meta updates through update actions', async () => {
    const created = await callAction<{ id: number }>(
      'createPost',
      {
        meta: {
          test_integer_meta: 3,
          test_string_meta: 'before',
        },
        status: 'draft',
        title: 'Meta behavior: partial update base',
      },
      { authHeader: basicAuth }
    );

    trackCreated('deletePost', created.id);

    const updated = await callAction<{ meta?: FixtureFields }>(
      'updatePost',
      {
        id: created.id,
        meta: {
          test_string_meta: 'after',
        },
      },
      { authHeader: basicAuth }
    );

    expect(getMeta(updated).test_string_meta).toBe('after');
    expect(getMeta(updated).test_integer_meta).toBe(3);
  });

  it('accepts one custom response schema for action-level parsing', async () => {
    const result = await callAction<{
      id: number;
      type: string;
      status: string;
    }>(
      'createPostResponseOverride',
      {
        status: 'draft',
        title: 'Meta behavior: schema override',
      },
      { authHeader: basicAuth }
    );

    trackCreated('deletePost', result.id);
    expect(result.id).toBeGreaterThan(0);
    expect(result.status).toBe('draft');
  });

  it('maps authentication failures to ActionError', async () => {
    await expect(
      callAction('createPost', {
        meta: {
          test_string_meta: 'not-authorized',
        },
        status: 'draft',
        title: 'Meta behavior: should fail',
      })
    ).rejects.toMatchObject({ type: 'AstroActionError' });
  });
});
