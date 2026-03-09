import { describe, it, expect, afterAll } from 'vitest';
import { ActionError } from 'astro/actions/runtime/server.js';
import { z } from 'astro/zod';
import {
  createPostInputSchema,
  updatePostInputSchema,
  executeCreatePost,
  executeUpdatePost,
  executeDeletePost,
} from '../../../src/actions';
import { createBasicAuthHeader } from 'fluent-wp-client';
import { createActionBaseConfig } from '../../helpers/wp-client';

/**
 * Astro action-layer integration for custom-field behavior.
 *
 * This suite focuses on package behavior: extensible action schemas, forwarding
 * custom ACF-shaped payloads, and ActionError mapping.
 */
describe('Actions: ACF behavior', () => {
  const actionBaseConfig = createActionBaseConfig();
  const authHeader = createBasicAuthHeader({
    username: 'admin',
    password: process.env.WP_APP_PASSWORD!,
  });

  const authConfig = {
    ...actionBaseConfig,
    authHeader,
  };

  const anonConfig = {
    ...actionBaseConfig,
    authHeader: '',
  };

  const createdIds: number[] = [];

  /**
   * Reads normalized ACF data from one action response.
   */
  function getAcf(value: unknown): Record<string, unknown> {
    const acf = (value as { acf?: Record<string, unknown> | null }).acf;

    if (!acf) {
      return {};
    }

    return acf;
  }

  afterAll(async () => {
    for (const id of createdIds) {
      await executeDeletePost(authConfig, { id, force: true }).catch(() => undefined);
    }
  });

  it('allows extending create schema with ACF fields', () => {
    const schema = createPostInputSchema.extend({
      acf: z.object({
        acf_subtitle: z.string().min(1),
      }).optional(),
    });

    const parsed = schema.parse({
      title: 'ACF behavior: schema create',
      status: 'draft',
      acf: {
        acf_subtitle: 'valid subtitle',
      },
    });

    expect(parsed.acf?.acf_subtitle).toBe('valid subtitle');
  });

  it('allows extending update schema with ACF fields and preserves id requirement', () => {
    const schema = updatePostInputSchema.extend({
      acf: z.object({
        acf_priority_score: z.number().int().min(0).max(100),
      }).optional(),
    });

    const parsed = schema.parse({
      id: 123,
      acf: {
        acf_priority_score: 42,
      },
    });

    expect(parsed.id).toBe(123);
    expect(parsed.acf?.acf_priority_score).toBe(42);
  });

  it('forwards ACF payloads in create and update execute helpers', async () => {
    const created = await executeCreatePost(authConfig, {
      title: 'ACF behavior: create passthrough',
      status: 'draft',
      acf: {
        acf_subtitle: 'initial subtitle',
        acf_priority_score: 10,
      },
    });

    createdIds.push(created.id);
    expect(getAcf(created).acf_subtitle).toBe('initial subtitle');

    const updated = await executeUpdatePost(authConfig, {
      id: created.id,
      acf: {
        acf_subtitle: 'updated subtitle',
      },
    });

    expect(getAcf(updated).acf_subtitle).toBe('updated subtitle');
    expect(getAcf(updated).acf_priority_score).toBe(10);
  });

  it('maps unauthenticated custom-field writes to ActionError', async () => {
    await expect(
      executeCreatePost(anonConfig, {
        title: 'ACF behavior: unauthorized',
        status: 'draft',
        acf: {
          acf_subtitle: 'no auth',
        },
      }),
    ).rejects.toThrow(ActionError);
  });
});
