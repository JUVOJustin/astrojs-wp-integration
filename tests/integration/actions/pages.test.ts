import { describe, it, expect, afterAll } from 'vitest';
import { ActionError } from 'astro/actions/runtime/server.js';
import { executeCreatePost } from '../../../src/actions/post/create';
import { executeUpdatePost } from '../../../src/actions/post/update';
import { executeDeletePost } from '../../../src/actions/post/delete';
import { createBasicAuthHeader } from '../../../src/client/auth';
import { pageSchema } from '../../../src/schemas';
import { getBaseUrl } from '../../helpers/wp-client';

/**
 * Integration tests for page CRUD via the execute* functions with resource='pages'.
 * Verifies that the same action helpers work correctly for hierarchical post types.
 * Cleanup permanently removes any pages created during the suite.
 */
describe('Actions: Pages CRUD', () => {
  const baseUrl = getBaseUrl();
  const apiBase = `${baseUrl}/wp-json/wp/v2`;

  const authConfig = {
    apiBase,
    authHeader: createBasicAuthHeader({
      username: 'admin',
      password: process.env.WP_APP_PASSWORD!,
    }),
    resource: 'pages' as const,
    responseSchema: pageSchema,
  };

  const anonConfig = {
    apiBase,
    authHeader: '',
    resource: 'pages' as const,
    responseSchema: pageSchema,
  };

  /** Config for delete (no responseSchema needed) */
  const deleteConfig = {
    apiBase,
    authHeader: authConfig.authHeader,
    resource: 'pages' as const,
  };

  const createdIds: number[] = [];

  afterAll(async () => {
    for (const id of createdIds) {
      await executeDeletePost(deleteConfig, { id, force: true }).catch(() => {});
    }
  });

  const updateConfig = {
    apiBase,
    authHeader: authConfig.authHeader,
    resource: 'pages' as const,
    responseSchema: pageSchema,
  };

  describe('resource-specific behavior', () => {
    it('creates a hierarchical page with parent and menu_order fields', async () => {
      const parent = await executeCreatePost(authConfig, {
        title: 'Action Test: Parent Page',
        status: 'draft',
      });
      createdIds.push(parent.id);

      const child = await executeCreatePost(authConfig, {
        title: 'Action Test: Child Page',
        content: '<p>Child page content.</p>',
        excerpt: 'Child excerpt',
        parent: parent.id,
        menu_order: 5,
        status: 'draft',
      });
      createdIds.push(child.id);

      expect(child.type).toBe('page');
      expect(child.parent).toBe(parent.id);
      expect(child.menu_order).toBe(5);
      expect(child.content.rendered).toContain('Child page content.');
      expect(child.excerpt.rendered).toContain('Child excerpt');
    });

    it('updates page-specific hierarchical fields', async () => {
      const parent = await executeCreatePost(authConfig, {
        title: 'Action Test: Update Parent',
        status: 'draft',
      });
      createdIds.push(parent.id);

      const child = await executeCreatePost(authConfig, {
        title: 'Action Test: Update Child',
        status: 'draft',
      });
      createdIds.push(child.id);

      const updated = await executeUpdatePost(updateConfig, {
        id: child.id,
        parent: parent.id,
        menu_order: 42,
      });

      expect(updated.type).toBe('page');
      expect(updated.parent).toBe(parent.id);
      expect(updated.menu_order).toBe(42);
    });

    it('permanently deletes a page through the pages endpoint', async () => {
      const page = await executeCreatePost(authConfig, {
        title: 'Action Test: Delete Page',
        status: 'draft',
      });
      createdIds.push(page.id);

      const deleted = await executeDeletePost(deleteConfig, { id: page.id, force: true });

      expect(deleted.id).toBe(page.id);
      expect(deleted.deleted).toBe(true);
    });
  });

  describe('error behavior', () => {
    it('throws ActionError when not authenticated', async () => {
      await expect(
        executeCreatePost(anonConfig, { title: 'Should Fail', status: 'draft' })
      ).rejects.toThrow(ActionError);
    });

    it('throws ActionError for a non-existent page ID on update', async () => {
      await expect(
        executeUpdatePost(updateConfig, { id: 999999, title: 'Ghost Page' })
      ).rejects.toThrow(ActionError);
    });
  });
});
