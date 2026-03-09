import { describe, it, expect, afterAll } from 'vitest';
import { ActionError } from 'astro/actions/runtime/server.js';
import { z } from 'astro/zod';
import {
  createCreatePostAction,
  createUpdatePostAction,
  createPostInputSchema,
  updatePostInputSchema,
  executeCreatePost,
  executeDeletePost,
} from '../../../src/actions';
import { createBasicAuthHeader, contentWordPressSchema } from 'fluent-wp-client';
import { createActionBaseConfig } from '../../helpers/wp-client';
import { callActionOrThrow } from '../../helpers/call-action';

/**
 * Astro action integration for custom post type resource behavior.
 */
describe('Actions: Books', () => {
  const actionBaseConfig = createActionBaseConfig();
  const authHeader = createBasicAuthHeader({
    username: 'admin',
    password: process.env.WP_APP_PASSWORD!,
  });

  const bookConfig = {
    ...actionBaseConfig,
    authHeader,
    resource: 'books' as const,
    responseSchema: contentWordPressSchema,
  };

  const createdIds: number[] = [];

  afterAll(async () => {
    for (const id of createdIds) {
      await executeDeletePost(
        {
          ...actionBaseConfig,
          authHeader,
          resource: 'books',
        },
        { id, force: true },
      ).catch(() => undefined);
    }
  });

  it('routes create action to custom post type resource endpoint', async () => {
    const createBookAction = createCreatePostAction({
      baseUrl: bookConfig.baseUrl,
      auth: { username: 'admin', password: process.env.WP_APP_PASSWORD! },
      resource: 'books',
      responseSchema: contentWordPressSchema,
    });

    const created = await callActionOrThrow(createBookAction, {
      title: 'Books behavior: action create',
      status: 'draft',
      meta: {
        test_book_isbn: '978-0-00-000000-1',
      },
    } as never);

    createdIds.push(created.id);
    expect(created.type).toBe('book');
  });

  it('supports custom schema extension for CPT-specific fields', async () => {
    const createBookAction = createCreatePostAction({
      baseUrl: bookConfig.baseUrl,
      auth: { username: 'admin', password: process.env.WP_APP_PASSWORD! },
      resource: 'books',
      responseSchema: contentWordPressSchema,
      schema: createPostInputSchema.extend({
        custom_note: z.string().min(3).optional(),
      }),
    });

    const created = await callActionOrThrow(createBookAction, {
      title: 'Books behavior: schema extension',
      status: 'draft',
      custom_note: 'typed-input-extension',
    } as never);

    createdIds.push(created.id);
    expect(created.type).toBe('book');
  });

  it('supports response schema override for CPT action responses', async () => {
    const createBookAction = createCreatePostAction({
      baseUrl: bookConfig.baseUrl,
      auth: { username: 'admin', password: process.env.WP_APP_PASSWORD! },
      resource: 'books',
      responseSchema: z.object({
        id: z.number().int().positive(),
        type: z.literal('book'),
        status: z.string(),
      }),
    });

    const created = await callActionOrThrow(createBookAction, {
      title: 'Books behavior: response override',
      status: 'draft',
    } as never);

    createdIds.push(created.id);
    expect(created.type).toBe('book');
  });

  it('updates CPT content through configured books resource', async () => {
    const created = await executeCreatePost(bookConfig, {
      title: 'Books behavior: update base',
      status: 'draft',
    });
    createdIds.push(created.id);

    const updateBookAction = createUpdatePostAction({
      baseUrl: bookConfig.baseUrl,
      auth: { username: 'admin', password: process.env.WP_APP_PASSWORD! },
      resource: 'books',
      responseSchema: contentWordPressSchema,
      schema: updatePostInputSchema.extend({
        custom_note: z.string().optional(),
      }),
    });

    const updated = await callActionOrThrow(updateBookAction, {
      id: created.id,
      title: 'Books behavior: updated title',
      custom_note: 'typed-update-extension',
    } as never);

    expect(updated.type).toBe('book');
    expect(updated.title.rendered).toBe('Books behavior: updated title');
  });

  it('maps CPT write auth failures to ActionError', async () => {
    await expect(
      executeCreatePost(
        {
          ...bookConfig,
          authHeader: '',
        },
        {
          title: 'Books behavior: unauthorized',
          status: 'draft',
        },
      ),
    ).rejects.toThrow(ActionError);
  });
});
