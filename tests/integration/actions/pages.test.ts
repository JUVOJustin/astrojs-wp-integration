import { describe, it, expect, afterAll } from 'vitest';
import { ActionError } from 'astro/actions/runtime/server.js';
import { z } from 'astro/zod';
import {
  createCreatePostAction,
  createUpdatePostAction,
  updatePostInputSchema,
  executeCreatePost,
  executeDeletePost,
} from '../../../src/actions';
import { createBasicAuthHeader, pageSchema } from 'fluent-wp-client';
import { createActionBaseConfig } from '../../helpers/wp-client';

/**
 * Astro action integration for page-targeted resource behavior.
 */
describe('Actions: Pages', () => {
  const actionBaseConfig = createActionBaseConfig();
  const authHeader = createBasicAuthHeader({
    username: 'admin',
    password: process.env.WP_APP_PASSWORD!,
  });

  const pageConfig = {
    ...actionBaseConfig,
    authHeader,
    resource: 'pages' as const,
    responseSchema: pageSchema,
  };

  const createdIds: number[] = [];

  afterAll(async () => {
    for (const id of createdIds) {
      await executeDeletePost(
        {
          ...actionBaseConfig,
          authHeader,
          resource: 'pages',
        },
        { id, force: true },
      ).catch(() => undefined);
    }
  });

  it('routes create action to pages endpoint and returns page response shape', async () => {
    const createPageAction = createCreatePostAction({
      baseUrl: pageConfig.baseUrl,
      auth: { username: 'admin', password: process.env.WP_APP_PASSWORD! },
      resource: 'pages',
      responseSchema: pageSchema,
    });

    const created = await createPageAction.orThrow({
      title: 'Pages behavior: action create',
      status: 'draft',
      parent: 0,
      menu_order: 9,
    } as never);

    createdIds.push(created.id);
    expect(created.type).toBe('page');
    expect(created.menu_order).toBe(9);
  });

  it('supports custom page input schema extensions in update action', async () => {
    const page = await executeCreatePost(pageConfig, {
      title: 'Pages behavior: update schema base',
      status: 'draft',
    });
    createdIds.push(page.id);

    const updatePageAction = createUpdatePostAction({
      baseUrl: pageConfig.baseUrl,
      auth: { username: 'admin', password: process.env.WP_APP_PASSWORD! },
      resource: 'pages',
      responseSchema: pageSchema,
      schema: updatePostInputSchema.extend({
        acf: z.object({
          acf_subtitle: z.string().optional(),
        }).optional(),
      }),
    });

    const updated = await updatePageAction.orThrow({
      id: page.id,
      menu_order: 21,
      acf: {
        acf_subtitle: 'page action update',
      },
    } as never);

    expect(updated.type).toBe('page');
    expect(updated.menu_order).toBe(21);
  });

  it('supports response schema override for pages actions', async () => {
    const createPageAction = createCreatePostAction({
      baseUrl: pageConfig.baseUrl,
      auth: { username: 'admin', password: process.env.WP_APP_PASSWORD! },
      resource: 'pages',
      responseSchema: z.object({
        id: z.number().int().positive(),
        type: z.literal('page'),
        status: z.string(),
      }),
    });

    const created = await createPageAction.orThrow({
      title: 'Pages behavior: response override',
      status: 'draft',
    } as never);

    createdIds.push(created.id);
    expect(created.type).toBe('page');
  });

  it('maps page write auth failures to ActionError', async () => {
    await expect(
      executeCreatePost(
        {
          ...pageConfig,
          authHeader: '',
        },
        {
          title: 'Pages behavior: unauthorized',
          status: 'draft',
        },
      ),
    ).rejects.toThrow(ActionError);
  });
});
