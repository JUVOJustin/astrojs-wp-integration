import { describe, it, expect, afterAll } from 'vitest';
import { ActionError } from 'astro/actions/runtime/server.js';
import { executeCreatePost } from '../../../src/actions/post/create';
import { executeUpdatePost } from '../../../src/actions/post/update';
import { executeDeletePost } from '../../../src/actions/post/delete';
import { createBasicAuthHeader, createJwtAuthHeader } from '../../../src/client/auth';
import { getBaseUrl } from '../../helpers/wp-client';

/**
 * Integration tests for CRUD server actions (create, update, delete).
 * Each `execute*` function is tested directly — no Astro runtime needed.
 * Cleanup is performed in `afterAll` to permanently remove any posts created during the suite.
 */
describe('Actions: CRUD', () => {
  const baseUrl = getBaseUrl();
  const apiBase = `${baseUrl}/wp-json/wp/v2`;

  // Authenticated config used for all write operations
  const authConfig = {
    apiBase,
    authHeader: createBasicAuthHeader({
      username: 'admin',
      password: process.env.WP_APP_PASSWORD!,
    }),
  };

  // Authenticated config for user-scoped SSR flows using JWT tokens
  const jwtAuthConfig = {
    apiBase,
    authHeader: createJwtAuthHeader(process.env.WP_JWT_TOKEN!),
  };

  // Request-aware auth config for signature-like auth strategies
  const requestAwareAuthConfig = {
    apiBase,
    authHeaders: ({ method, url }: { method: string; url: URL }) => {
      if (method !== 'POST') {
        throw new Error('Expected POST for create post auth provider test.');
      }

      if (!url.pathname.endsWith('/wp-json/wp/v2/posts')) {
        throw new Error('Expected posts endpoint for create post auth provider test.');
      }

      return {
        Authorization: createJwtAuthHeader(process.env.WP_JWT_TOKEN!),
      };
    },
  };

  // Unauthenticated config — used to verify auth enforcement
  const anonConfig = {
    apiBase,
    authHeader: '',
  };

  // Track created post IDs so we can clean them up even if tests fail
  const createdIds: number[] = [];

  afterAll(async () => {
    // Permanently delete every post created during the test suite
    for (const id of createdIds) {
      await executeDeletePost(authConfig, { id, force: true }).catch(() => {
        // Already deleted or never fully created — ignore
      });
    }
  });

  // ---------------------------------------------------------------------------
  // executeCreatePost
  // ---------------------------------------------------------------------------

  describe('executeCreatePost', () => {
    it('creates a draft post with the given title', async () => {
      const post = await executeCreatePost(authConfig, {
        title: 'Action Test: Draft Post',
        status: 'draft',
      });

      createdIds.push(post.id);

      expect(post.id).toBeGreaterThan(0);
      expect(post.title.rendered).toBe('Action Test: Draft Post');
      expect(post.status).toBe('draft');
    });

    it('creates a published post', async () => {
      const post = await executeCreatePost(authConfig, {
        title: 'Action Test: Published Post',
        status: 'publish',
      });

      createdIds.push(post.id);

      expect(post.status).toBe('publish');
    });

    it('creates a post with content and excerpt', async () => {
      const post = await executeCreatePost(authConfig, {
        title: 'Action Test: With Content',
        content: '<p>Hello from integration test.</p>',
        excerpt: 'Test excerpt',
        status: 'draft',
      });

      createdIds.push(post.id);

      expect(post.content.rendered).toContain('Hello from integration test.');
      expect(post.excerpt.rendered).toContain('Test excerpt');
    });

    it('creates a post when authenticated with JWT', async () => {
      const post = await executeCreatePost(jwtAuthConfig, {
        title: 'Action Test: JWT Auth',
        status: 'draft',
      });

      createdIds.push(post.id);

      expect(post.id).toBeGreaterThan(0);
      expect(post.title.rendered).toBe('Action Test: JWT Auth');
    });

    it('creates a post with request-aware auth headers', async () => {
      const post = await executeCreatePost(requestAwareAuthConfig, {
        title: 'Action Test: Request-Aware Auth',
        status: 'draft',
      });

      createdIds.push(post.id);

      expect(post.id).toBeGreaterThan(0);
      expect(post.title.rendered).toBe('Action Test: Request-Aware Auth');
    });

    it('throws ActionError when not authenticated', async () => {
      await expect(
        executeCreatePost(anonConfig, { title: 'Should Fail', status: 'draft' })
      ).rejects.toThrow(ActionError);
    });
  });

  // ---------------------------------------------------------------------------
  // executeUpdatePost
  // ---------------------------------------------------------------------------

  describe('executeUpdatePost', () => {
    it('updates the title of an existing post', async () => {
      // Create a post to update
      const created = await executeCreatePost(authConfig, {
        title: 'Action Test: Before Update',
        status: 'draft',
      });
      createdIds.push(created.id);

      const updated = await executeUpdatePost(authConfig, {
        id: created.id,
        title: 'Action Test: After Update',
      });

      expect(updated.id).toBe(created.id);
      expect(updated.title.rendered).toBe('Action Test: After Update');
    });

    it('updates the status of a post', async () => {
      const created = await executeCreatePost(authConfig, {
        title: 'Action Test: Status Change',
        status: 'draft',
      });
      createdIds.push(created.id);

      const updated = await executeUpdatePost(authConfig, {
        id: created.id,
        status: 'publish',
      });

      expect(updated.status).toBe('publish');
    });

    it('throws ActionError for a non-existent post ID', async () => {
      await expect(
        executeUpdatePost(authConfig, { id: 999999, title: 'Ghost Post' })
      ).rejects.toThrow(ActionError);
    });
  });

  // ---------------------------------------------------------------------------
  // executeDeletePost
  // ---------------------------------------------------------------------------

  describe('executeDeletePost', () => {
    it('moves a post to trash (no force)', async () => {
      const created = await executeCreatePost(authConfig, {
        title: 'Action Test: Trash Me',
        status: 'draft',
      });
      // Do NOT push to createdIds — we are verifying trash behaviour here;
      // the afterAll cleanup will still try to delete it and silently skip if already gone.
      createdIds.push(created.id);

      const result = await executeDeletePost(authConfig, { id: created.id });

      expect(result.id).toBe(created.id);
      expect(result.deleted).toBe(false);
    });

    it('permanently deletes a post (force=true)', async () => {
      const created = await executeCreatePost(authConfig, {
        title: 'Action Test: Destroy Me',
        status: 'draft',
      });

      const result = await executeDeletePost(authConfig, { id: created.id, force: true });

      expect(result.id).toBe(created.id);
      expect(result.deleted).toBe(true);
      // Verify the post is gone — the REST API should return 404
    });

    it('throws ActionError for a non-existent post ID', async () => {
      await expect(
        executeDeletePost(authConfig, { id: 999999, force: true })
      ).rejects.toThrow(ActionError);
    });
  });
});
