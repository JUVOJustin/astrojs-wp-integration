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

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------

  describe('executeCreatePost (books)', () => {
    it('creates a draft book with the given title', async () => {
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

    it('creates a published book', async () => {
      const book = await executeCreatePost(authConfig, {
        title: 'Action Test: Published Book',
        status: 'publish',
      });

      createdIds.push(book.id);

      expect(book.status).toBe('publish');
      expect(book.type).toBe('book');
    });

    it('creates a book with content and excerpt', async () => {
      const book = await executeCreatePost(authConfig, {
        title: 'Action Test: Book With Content',
        content: '<p>A fascinating book about testing.</p>',
        excerpt: 'Book test excerpt',
        status: 'draft',
      });

      createdIds.push(book.id);

      expect(book.content.rendered).toContain('A fascinating book about testing.');
      expect(book.excerpt.rendered).toContain('Book test excerpt');
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

  describe('executeUpdatePost (books)', () => {
    it('updates the title of an existing book', async () => {
      const created = await executeCreatePost(authConfig, {
        title: 'Action Test: Book Before Update',
        status: 'draft',
      });
      createdIds.push(created.id);

      const updated = await executeUpdatePost(
        { apiBase, authHeader: authConfig.authHeader, resource: 'books', responseSchema: contentWordPressSchema },
        { id: created.id, title: 'Action Test: Book After Update' }
      );

      expect(updated.id).toBe(created.id);
      expect(updated.title.rendered).toBe('Action Test: Book After Update');
    });

    it('updates the status of a book', async () => {
      const created = await executeCreatePost(authConfig, {
        title: 'Action Test: Book Status Change',
        status: 'draft',
      });
      createdIds.push(created.id);

      const updated = await executeUpdatePost(
        { apiBase, authHeader: authConfig.authHeader, resource: 'books', responseSchema: contentWordPressSchema },
        { id: created.id, status: 'publish' }
      );

      expect(updated.status).toBe('publish');
    });

    it('throws ActionError for a non-existent book ID', async () => {
      await expect(
        executeUpdatePost(
          { apiBase, authHeader: authConfig.authHeader, resource: 'books', responseSchema: contentWordPressSchema },
          { id: 999999, title: 'Ghost Book' }
        )
      ).rejects.toThrow(ActionError);
    });
  });

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  describe('executeDeletePost (books)', () => {
    it('moves a book to trash (no force)', async () => {
      const created = await executeCreatePost(authConfig, {
        title: 'Action Test: Trash Book',
        status: 'draft',
      });
      createdIds.push(created.id);

      const result = await executeDeletePost(deleteConfig, { id: created.id });

      expect(result.id).toBe(created.id);
      expect(result.deleted).toBe(false);
    });

    it('permanently deletes a book (force=true)', async () => {
      const created = await executeCreatePost(authConfig, {
        title: 'Action Test: Destroy Book',
        status: 'draft',
      });

      const result = await executeDeletePost(deleteConfig, { id: created.id, force: true });

      expect(result.id).toBe(created.id);
      expect(result.deleted).toBe(true);
    });

    it('throws ActionError for a non-existent book ID', async () => {
      await expect(
        executeDeletePost(deleteConfig, { id: 999999, force: true })
      ).rejects.toThrow(ActionError);
    });
  });
});
