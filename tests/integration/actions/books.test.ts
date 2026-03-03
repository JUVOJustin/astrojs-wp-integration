import { describe, it, expect, afterAll } from 'vitest';
import { ActionError } from 'astro/actions/runtime/server.js';
import { executeCreatePost } from '../../../src/actions/post/create';
import { executeUpdatePost } from '../../../src/actions/post/update';
import { executeDeletePost } from '../../../src/actions/post/delete';
import { createBasicAuthHeader } from '../../../src/client/auth';
import { contentWordPressSchema } from '../../../src/schemas';
import { getBaseUrl } from '../../helpers/wp-client';

/**
 * Integration tests for custom post type (book) CRUD via the execute* functions.
 * The 'book' CPT is registered by the mu-plugin at tests/wp-env/mu-plugins/register-book-cpt.php
 * and uses rest_base='books', so the endpoint is /wp-json/wp/v2/books.
 *
 * Uses contentWordPressSchema for response parsing — books don't have
 * post-specific fields like sticky, format, categories, or tags.
 */
describe('Actions: Books (CPT) CRUD', () => {
  const baseUrl = getBaseUrl();
  const apiBase = `${baseUrl}/wp-json/wp/v2`;

  const authConfig = {
    apiBase,
    authHeader: createBasicAuthHeader({
      username: 'admin',
      password: process.env.WP_APP_PASSWORD!,
    }),
    resource: 'books' as const,
    responseSchema: contentWordPressSchema,
  };

  const anonConfig = {
    apiBase,
    authHeader: '',
    resource: 'books' as const,
    responseSchema: contentWordPressSchema,
  };

  const deleteConfig = {
    apiBase,
    authHeader: authConfig.authHeader,
    resource: 'books' as const,
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
    resource: 'books' as const,
    responseSchema: contentWordPressSchema,
  };

  describe('resource-specific behavior', () => {
    it('creates a book through the books endpoint', async () => {
      const book = await executeCreatePost(authConfig, {
        title: 'Action Test: Draft Book',
        status: 'draft',
      });

      createdIds.push(book.id);

      expect(book.id).toBeGreaterThan(0);
      expect(book.title.rendered).toBe('Action Test: Draft Book');
      expect(book.status).toBe('draft');
      expect(book.type).toBe('book');
    });

    it('updates an existing book through the books endpoint', async () => {
      const created = await executeCreatePost(authConfig, {
        title: 'Action Test: Book Before Update',
        status: 'draft',
      });
      createdIds.push(created.id);

      const updated = await executeUpdatePost(updateConfig, {
        id: created.id,
        title: 'Action Test: Book After Update',
        status: 'publish',
      });

      expect(updated.id).toBe(created.id);
      expect(updated.type).toBe('book');
      expect(updated.title.rendered).toBe('Action Test: Book After Update');
      expect(updated.status).toBe('publish');
    });

    it('permanently deletes a book through the books endpoint', async () => {
      const created = await executeCreatePost(authConfig, {
        title: 'Action Test: Destroy Book',
        status: 'draft',
      });
      createdIds.push(created.id);

      const deleted = await executeDeletePost(deleteConfig, { id: created.id, force: true });

      expect(deleted.id).toBe(created.id);
      expect(deleted.deleted).toBe(true);
    });
  });

  describe('error behavior', () => {
    it('throws ActionError when not authenticated', async () => {
      await expect(
        executeCreatePost(anonConfig, { title: 'Should Fail', status: 'draft' })
      ).rejects.toThrow(ActionError);
    });

    it('throws ActionError for a non-existent book ID on update', async () => {
      await expect(
        executeUpdatePost(updateConfig, { id: 999999, title: 'Ghost Book' })
      ).rejects.toThrow(ActionError);
    });
  });
});
