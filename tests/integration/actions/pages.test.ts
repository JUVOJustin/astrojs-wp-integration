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

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------

  describe('executeCreatePost (pages)', () => {
    it('creates a draft page with the given title', async () => {
      const page = await executeCreatePost(authConfig, {
        title: 'Action Test: Draft Page',
        status: 'draft',
      });

      createdIds.push(page.id);

      expect(page.id).toBeGreaterThan(0);
      expect(page.title.rendered).toBe('Action Test: Draft Page');
      expect(page.status).toBe('draft');
      expect(page.type).toBe('page');
    });

    it('creates a published page', async () => {
      const page = await executeCreatePost(authConfig, {
        title: 'Action Test: Published Page',
        status: 'publish',
      });

      createdIds.push(page.id);

      expect(page.status).toBe('publish');
      expect(page.type).toBe('page');
    });

    it('creates a page with content, excerpt, and parent', async () => {
      // Create a parent page first
      const parent = await executeCreatePost(authConfig, {
        title: 'Action Test: Parent Page',
        status: 'publish',
      });
      createdIds.push(parent.id);

      const child = await executeCreatePost(authConfig, {
        title: 'Action Test: Child Page',
        content: '<p>Child page content.</p>',
        excerpt: 'Child excerpt',
        parent: parent.id,
        menu_order: 5,
        status: 'publish',
      });
      createdIds.push(child.id);

      expect(child.content.rendered).toContain('Child page content.');
      expect(child.excerpt.rendered).toContain('Child excerpt');
      expect(child.parent).toBe(parent.id);
      expect(child.menu_order).toBe(5);
    });

    it('throws ActionError when not authenticated', async () => {
      await expect(
        executeCreatePost(anonConfig, { title: 'Should Fail', status: 'draft' })
      ).rejects.toThrow(ActionError);
    });
  });

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------

  describe('executeUpdatePost (pages)', () => {
    it('updates the title of an existing page', async () => {
      const created = await executeCreatePost(authConfig, {
        title: 'Action Test: Page Before Update',
        status: 'draft',
      });
      createdIds.push(created.id);

      const updated = await executeUpdatePost(
        { apiBase, authHeader: authConfig.authHeader, resource: 'pages', responseSchema: pageSchema },
        { id: created.id, title: 'Action Test: Page After Update' }
      );

      expect(updated.id).toBe(created.id);
      expect(updated.title.rendered).toBe('Action Test: Page After Update');
    });

    it('updates the status of a page', async () => {
      const created = await executeCreatePost(authConfig, {
        title: 'Action Test: Page Status Change',
        status: 'draft',
      });
      createdIds.push(created.id);

      const updated = await executeUpdatePost(
        { apiBase, authHeader: authConfig.authHeader, resource: 'pages', responseSchema: pageSchema },
        { id: created.id, status: 'publish' }
      );

      expect(updated.status).toBe('publish');
    });

    it('updates the menu_order of a page', async () => {
      const created = await executeCreatePost(authConfig, {
        title: 'Action Test: Page Order',
        status: 'draft',
      });
      createdIds.push(created.id);

      const updated = await executeUpdatePost(
        { apiBase, authHeader: authConfig.authHeader, resource: 'pages', responseSchema: pageSchema },
        { id: created.id, menu_order: 42 }
      );

      expect(updated.menu_order).toBe(42);
    });

    it('throws ActionError for a non-existent page ID', async () => {
      await expect(
        executeUpdatePost(
          { apiBase, authHeader: authConfig.authHeader, resource: 'pages', responseSchema: pageSchema },
          { id: 999999, title: 'Ghost Page' }
        )
      ).rejects.toThrow(ActionError);
    });
  });

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  describe('executeDeletePost (pages)', () => {
    it('moves a page to trash (no force)', async () => {
      const created = await executeCreatePost(authConfig, {
        title: 'Action Test: Trash Page',
        status: 'draft',
      });
      createdIds.push(created.id);

      const result = await executeDeletePost(deleteConfig, { id: created.id });

      expect(result.id).toBe(created.id);
      expect(result.deleted).toBe(false);
    });

    it('permanently deletes a page (force=true)', async () => {
      const created = await executeCreatePost(authConfig, {
        title: 'Action Test: Destroy Page',
        status: 'draft',
      });

      const result = await executeDeletePost(deleteConfig, { id: created.id, force: true });

      expect(result.id).toBe(created.id);
      expect(result.deleted).toBe(true);
    });

    it('throws ActionError for a non-existent page ID', async () => {
      await expect(
        executeDeletePost(deleteConfig, { id: 999999, force: true })
      ).rejects.toThrow(ActionError);
    });
  });
});
