import { describe, it, expect, afterAll } from 'vitest';
import { ActionError } from 'astro/actions/runtime/server.js';
import { z } from 'astro/zod';
import { executeCreatePost } from '../../../src/actions/post/create';
import { executeUpdatePost } from '../../../src/actions/post/update';
import { executeDeletePost } from '../../../src/actions/post/delete';
import {
  createBasicAuthHeader,
  pageSchema,
  contentWordPressSchema,
} from 'fluent-wp-client';
import { createActionBaseConfig } from '../../helpers/wp-client';

/**
 * Astro action-layer integration for meta passthrough behavior.
 *
 * This suite intentionally avoids exhaustive WordPress meta semantics that are
 * already covered in `fluent-wp-client`. It focuses on package behavior:
 * resource routing, schema override wiring, and action-style error mapping.
 */
describe('Actions: Meta behavior', () => {
  const actionBaseConfig = createActionBaseConfig();
  const authHeader = createBasicAuthHeader({
    username: 'admin',
    password: process.env.WP_APP_PASSWORD!,
  });

  const postConfig = { ...actionBaseConfig, authHeader };
  const pageConfig = {
    ...actionBaseConfig,
    authHeader,
    resource: 'pages' as const,
    responseSchema: pageSchema,
  };
  const bookConfig = {
    ...actionBaseConfig,
    authHeader,
    resource: 'books' as const,
    responseSchema: contentWordPressSchema,
  };
  const anonConfig = { ...actionBaseConfig, authHeader: '' };

  const createdIds: Array<{ resource: 'posts' | 'pages' | 'books'; id: number }> = [];

  /**
   * Stores one created entity so suite cleanup can remove it.
   */
  function trackCreated(resource: 'posts' | 'pages' | 'books', id: number): void {
    createdIds.push({ resource, id });
  }

  /**
   * Reads normalized REST meta from one action response.
   */
  function getMeta(entry: unknown): Record<string, unknown> {
    const value = (entry as { meta?: Record<string, unknown> | unknown[] }).meta;

    if (!value || Array.isArray(value)) {
      return {};
    }

    return value;
  }

  afterAll(async () => {
    for (const created of createdIds) {
      await executeDeletePost(
        {
          ...actionBaseConfig,
          authHeader,
          resource: created.resource,
        },
        { id: created.id, force: true },
      ).catch(() => undefined);
    }
  });

  it('passes meta payloads through post, page, and CPT resources', async () => {
    const post = await executeCreatePost(postConfig, {
      title: 'Meta behavior: post passthrough',
      status: 'draft',
      meta: {
        test_string_meta: 'post-value',
        test_number_meta: 12.5,
      },
    });
    trackCreated('posts', post.id);

    const page = await executeCreatePost(pageConfig, {
      title: 'Meta behavior: page passthrough',
      status: 'draft',
      meta: {
        test_string_meta: 'page-value',
      },
    });
    trackCreated('pages', page.id);

    const book = await executeCreatePost(bookConfig, {
      title: 'Meta behavior: book passthrough',
      status: 'draft',
      meta: {
        test_string_meta: 'book-value',
        test_book_isbn: '978-1-23-456789-0',
      },
    });
    trackCreated('books', book.id);

    expect(getMeta(post).test_string_meta).toBe('post-value');
    expect(getMeta(page).test_string_meta).toBe('page-value');
    expect(getMeta(book).test_book_isbn).toBe('978-1-23-456789-0');
  });

  it('supports partial meta updates through executeUpdatePost', async () => {
    const created = await executeCreatePost(postConfig, {
      title: 'Meta behavior: partial update base',
      status: 'draft',
      meta: {
        test_string_meta: 'before',
        test_integer_meta: 3,
      },
    });
    trackCreated('posts', created.id);

    const updated = await executeUpdatePost(postConfig, {
      id: created.id,
      meta: {
        test_string_meta: 'after',
      },
    });

    expect(getMeta(updated).test_string_meta).toBe('after');
    expect(getMeta(updated).test_integer_meta).toBe(3);
  });

  it('accepts one custom response schema for action-level parsing', async () => {
    const minimalSchema = z.object({
      id: z.number().int().positive(),
      type: z.string().min(1),
      status: z.string().min(1),
    });

    const result = await executeCreatePost(
      {
        ...postConfig,
        responseSchema: minimalSchema,
      },
      {
        title: 'Meta behavior: schema override',
        status: 'draft',
      },
    );

    trackCreated('posts', result.id);
    expect(result.type).toBe('post');
    expect(result.status).toBe('draft');
  });

  it('maps authentication failures to ActionError', async () => {
    await expect(
      executeCreatePost(anonConfig, {
        title: 'Meta behavior: should fail',
        status: 'draft',
        meta: {
          test_string_meta: 'not-authorized',
        },
      }),
    ).rejects.toThrow(ActionError);
  });
});
