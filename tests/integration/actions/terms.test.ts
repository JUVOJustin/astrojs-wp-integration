import { describe, it, expect, afterAll } from 'vitest';
import { ActionError } from 'astro/actions/runtime/server.js';
import { z } from 'astro/zod';
import {
  createCreateTermAction,
  createUpdateTermAction,
  createDeleteTermAction,
  createTermInputSchema,
  updateTermInputSchema,
  executeCreateTerm,
  executeDeleteTerm,
} from '../../../src/actions';
import { createBasicAuthHeader, categorySchema } from 'fluent-wp-client';
import { createActionBaseConfig } from '../../helpers/wp-client';
import { callActionOrThrow } from '../../helpers/call-action';

/**
 * Astro action integration for taxonomy term resources.
 */
describe('Actions: Terms', () => {
  const actionBaseConfig = createActionBaseConfig();
  const authHeader = createBasicAuthHeader({
    username: 'admin',
    password: process.env.WP_APP_PASSWORD!,
  });

  const createdTerms: Array<{ resource: string; id: number }> = [];

  afterAll(async () => {
    for (const term of createdTerms) {
      await executeDeleteTerm(
        {
          ...actionBaseConfig,
          authHeader,
          resource: term.resource,
        },
        { id: term.id, force: true },
      ).catch(() => undefined);
    }
  });

  it('creates and updates categories through term actions', async () => {
    const createCategoryAction = createCreateTermAction({
      baseUrl: actionBaseConfig.baseUrl,
      auth: { username: 'admin', password: process.env.WP_APP_PASSWORD! },
      resource: 'categories',
      responseSchema: categorySchema,
      schema: createTermInputSchema.extend({
        custom_note: z.string().optional(),
      }),
    });

    const created = await callActionOrThrow(createCategoryAction, {
      name: 'Action category create',
      slug: 'action-category-create',
      custom_note: 'custom schema field',
    } as never);

    createdTerms.push({ resource: 'categories', id: created.id });
    expect(created.taxonomy).toBe('category');

    const updateCategoryAction = createUpdateTermAction({
      baseUrl: actionBaseConfig.baseUrl,
      auth: { username: 'admin', password: process.env.WP_APP_PASSWORD! },
      resource: 'categories',
      responseSchema: categorySchema,
      schema: updateTermInputSchema.extend({
        custom_note: z.string().optional(),
      }),
    });

    const updated = await callActionOrThrow(updateCategoryAction, {
      id: created.id,
      name: 'Action category updated',
      custom_note: 'typed update field',
    } as never);

    expect(updated.name).toBe('Action category updated');
  });

  it('creates and deletes tags through term actions', async () => {
    const createTagAction = createCreateTermAction({
      baseUrl: actionBaseConfig.baseUrl,
      auth: { username: 'admin', password: process.env.WP_APP_PASSWORD! },
      resource: 'tags',
      responseSchema: categorySchema,
    });

    const created = await callActionOrThrow(createTagAction, {
      name: 'Action tag create',
      slug: 'action-tag-create',
    } as never);

    expect(created.taxonomy).toBe('post_tag');

    const deleteTagAction = createDeleteTermAction({
      baseUrl: actionBaseConfig.baseUrl,
      auth: { username: 'admin', password: process.env.WP_APP_PASSWORD! },
      resource: 'tags',
    });

    const deleted = await callActionOrThrow(deleteTagAction, {
      id: created.id,
      force: true,
    } as never);

    expect(deleted.deleted).toBe(true);
  });

  it('supports custom taxonomy resources with response schema override', async () => {
    const createGenreAction = createCreateTermAction({
      baseUrl: actionBaseConfig.baseUrl,
      auth: { username: 'admin', password: process.env.WP_APP_PASSWORD! },
      resource: 'genres',
      responseSchema: z.object({
        id: z.number().int().positive(),
        taxonomy: z.literal('genre'),
        name: z.string(),
      }),
    });

    const created = await callActionOrThrow(createGenreAction, {
      name: 'Action genre create',
      slug: 'action-genre-create',
    } as never);

    createdTerms.push({ resource: 'genres', id: created.id });
    expect(created.taxonomy).toBe('genre');
  });

  it('maps term write auth failures to ActionError', async () => {
    await expect(
      executeCreateTerm(
        {
          ...actionBaseConfig,
          resource: 'categories',
          authHeader: '',
        },
        {
          name: 'Unauthorized term create',
        },
      ),
    ).rejects.toThrow(ActionError);
  });
});
