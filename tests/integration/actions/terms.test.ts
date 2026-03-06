import { describe, it, expect, afterAll } from 'vitest';
import { ActionError } from 'astro/actions/runtime/server.js';
import { executeCreateTerm } from '../../../src/actions/term/create';
import { executeUpdateTerm } from '../../../src/actions/term/update';
import { executeDeleteTerm } from '../../../src/actions/term/delete';
import { createBasicAuthHeader, createJwtAuthHeader } from '../../../src/client/auth';
import { getBaseUrl } from '../../helpers/wp-client';

/**
 * Integration tests for term CRUD server actions (create, update, delete).
 * Each `execute*` function is tested directly — no Astro runtime needed.
 *
 * Tests cover:
 *  - Categories (hierarchical, built-in taxonomy)
 *  - Tags (non-hierarchical, built-in taxonomy)
 *  - Genres (hierarchical, custom taxonomy on book CPT)
 *  - Term meta (native WordPress meta fields)
 *  - Auth enforcement (unauthenticated calls must fail)
 *  - JWT auth
 *
 * Cleanup permanently removes any terms created during the suite.
 */
describe('Actions: Terms CRUD', () => {
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

  // JWT-authenticated config
  const jwtAuthConfig = {
    apiBase,
    authHeader: createJwtAuthHeader(process.env.WP_JWT_TOKEN!),
  };

  // Unauthenticated config — used to verify auth enforcement
  const anonConfig = {
    apiBase,
    authHeader: '',
  };

  // Track created term IDs per resource for cleanup
  const createdIds: Record<string, number[]> = {
    categories: [],
    tags: [],
    genres: [],
  };

  afterAll(async () => {
    for (const [resource, ids] of Object.entries(createdIds)) {
      for (const id of ids) {
        await executeDeleteTerm(
          { ...authConfig, resource },
          { id, force: true }
        ).catch(() => {});
      }
    }
  });

  // ---------------------------------------------------------------------------
  // Categories (hierarchical, built-in)
  // ---------------------------------------------------------------------------

  describe('Categories', () => {
    const categoryConfig = { ...authConfig, resource: 'categories' as const };
    const categoryAnonConfig = { ...anonConfig, resource: 'categories' as const };

    describe('executeCreateTerm', () => {
      it('creates a category with a name', async () => {
        const term = await executeCreateTerm(categoryConfig, {
          name: 'Action Test Category',
        });

        createdIds.categories.push(term.id);

        expect(term.id).toBeGreaterThan(0);
        expect(term.name).toBe('Action Test Category');
        expect(term.taxonomy).toBe('category');
      });

      it('creates a category with name, slug, and description', async () => {
        const term = await executeCreateTerm(categoryConfig, {
          name: 'Detailed Category',
          slug: 'detailed-category-test',
          description: 'A category with all fields set.',
        });

        createdIds.categories.push(term.id);

        expect(term.slug).toBe('detailed-category-test');
        expect(term.description).toBe('A category with all fields set.');
      });

      it('creates a child category with parent', async () => {
        const parent = await executeCreateTerm(categoryConfig, {
          name: 'Parent Category',
        });
        createdIds.categories.push(parent.id);

        const child = await executeCreateTerm(categoryConfig, {
          name: 'Child Category',
          parent: parent.id,
        });
        createdIds.categories.push(child.id);

        expect(child.parent).toBe(parent.id);
      });

      it('creates a category when authenticated with JWT', async () => {
        const term = await executeCreateTerm(
          { ...jwtAuthConfig, resource: 'categories' },
          { name: 'JWT Category' }
        );

        createdIds.categories.push(term.id);

        expect(term.id).toBeGreaterThan(0);
        expect(term.name).toBe('JWT Category');
      });

      it('throws ActionError when not authenticated', async () => {
        await expect(
          executeCreateTerm(categoryAnonConfig, { name: 'Should Fail' })
        ).rejects.toThrow(ActionError);
      });
    });

    describe('executeUpdateTerm', () => {
      it('updates the name of an existing category', async () => {
        const created = await executeCreateTerm(categoryConfig, {
          name: 'Before Update Cat',
        });
        createdIds.categories.push(created.id);

        const updated = await executeUpdateTerm(categoryConfig, {
          id: created.id,
          name: 'After Update Cat',
        });

        expect(updated.id).toBe(created.id);
        expect(updated.name).toBe('After Update Cat');
      });

      it('updates description and slug', async () => {
        const created = await executeCreateTerm(categoryConfig, {
          name: 'Update Fields Cat',
        });
        createdIds.categories.push(created.id);

        const updated = await executeUpdateTerm(categoryConfig, {
          id: created.id,
          slug: 'updated-slug-cat',
          description: 'Updated description.',
        });

        expect(updated.slug).toBe('updated-slug-cat');
        expect(updated.description).toBe('Updated description.');
      });

      it('throws ActionError for a non-existent category ID', async () => {
        await expect(
          executeUpdateTerm(categoryConfig, { id: 999999, name: 'Ghost' })
        ).rejects.toThrow(ActionError);
      });
    });

    describe('executeDeleteTerm', () => {
      it('permanently deletes a category', async () => {
        const created = await executeCreateTerm(categoryConfig, {
          name: 'Delete Me Cat',
        });

        const result = await executeDeleteTerm(categoryConfig, { id: created.id });

        expect(result.id).toBe(created.id);
        expect(result.deleted).toBe(true);
      });

      it('throws ActionError for a non-existent category ID', async () => {
        await expect(
          executeDeleteTerm(categoryConfig, { id: 999999 })
        ).rejects.toThrow(ActionError);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Tags (non-hierarchical, built-in)
  // ---------------------------------------------------------------------------

  describe('Tags', () => {
    const tagConfig = { ...authConfig, resource: 'tags' as const };
    const tagAnonConfig = { ...anonConfig, resource: 'tags' as const };

    describe('executeCreateTerm', () => {
      it('creates a tag with a name', async () => {
        const term = await executeCreateTerm(tagConfig, {
          name: 'Action Test Tag',
        });

        createdIds.tags.push(term.id);

        expect(term.id).toBeGreaterThan(0);
        expect(term.name).toBe('Action Test Tag');
        expect(term.taxonomy).toBe('post_tag');
      });

      it('creates a tag with slug and description', async () => {
        const term = await executeCreateTerm(tagConfig, {
          name: 'Detailed Tag',
          slug: 'detailed-tag-test',
          description: 'A tag with all fields set.',
        });

        createdIds.tags.push(term.id);

        expect(term.slug).toBe('detailed-tag-test');
        expect(term.description).toBe('A tag with all fields set.');
      });

      it('throws ActionError when not authenticated', async () => {
        await expect(
          executeCreateTerm(tagAnonConfig, { name: 'Should Fail Tag' })
        ).rejects.toThrow(ActionError);
      });
    });

    describe('executeUpdateTerm', () => {
      it('updates the name of an existing tag', async () => {
        const created = await executeCreateTerm(tagConfig, {
          name: 'Before Update Tag',
        });
        createdIds.tags.push(created.id);

        const updated = await executeUpdateTerm(tagConfig, {
          id: created.id,
          name: 'After Update Tag',
        });

        expect(updated.id).toBe(created.id);
        expect(updated.name).toBe('After Update Tag');
      });

      it('throws ActionError for a non-existent tag ID', async () => {
        await expect(
          executeUpdateTerm(tagConfig, { id: 999999, name: 'Ghost Tag' })
        ).rejects.toThrow(ActionError);
      });
    });

    describe('executeDeleteTerm', () => {
      it('permanently deletes a tag', async () => {
        const created = await executeCreateTerm(tagConfig, {
          name: 'Delete Me Tag',
        });

        const result = await executeDeleteTerm(tagConfig, { id: created.id });

        expect(result.id).toBe(created.id);
        expect(result.deleted).toBe(true);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Custom Taxonomy — Genres (hierarchical, on book CPT)
  // ---------------------------------------------------------------------------

  describe('Custom Taxonomy (genres)', () => {
    const genreConfig = { ...authConfig, resource: 'genres' as const };

    describe('executeCreateTerm', () => {
      it('creates a genre term', async () => {
        const term = await executeCreateTerm(genreConfig, {
          name: 'Science Fiction',
        });

        createdIds.genres.push(term.id);

        expect(term.id).toBeGreaterThan(0);
        expect(term.name).toBe('Science Fiction');
        expect(term.taxonomy).toBe('genre');
      });

      it('creates a child genre with parent', async () => {
        const parent = await executeCreateTerm(genreConfig, {
          name: 'Fiction',
        });
        createdIds.genres.push(parent.id);

        const child = await executeCreateTerm(genreConfig, {
          name: 'Hard Sci-Fi',
          parent: parent.id,
        });
        createdIds.genres.push(child.id);

        expect(child.parent).toBe(parent.id);
      });
    });

    describe('executeUpdateTerm', () => {
      it('updates a genre term', async () => {
        const created = await executeCreateTerm(genreConfig, {
          name: 'Mystery',
        });
        createdIds.genres.push(created.id);

        const updated = await executeUpdateTerm(genreConfig, {
          id: created.id,
          name: 'Crime Mystery',
          description: 'Updated genre description.',
        });

        expect(updated.name).toBe('Crime Mystery');
        expect(updated.description).toBe('Updated genre description.');
      });
    });

    describe('executeDeleteTerm', () => {
      it('permanently deletes a genre term', async () => {
        const created = await executeCreateTerm(genreConfig, {
          name: 'Horror',
        });

        const result = await executeDeleteTerm(genreConfig, { id: created.id });

        expect(result.id).toBe(created.id);
        expect(result.deleted).toBe(true);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Term Meta
  // ---------------------------------------------------------------------------

  describe('Term Meta', () => {
    const categoryConfig = { ...authConfig, resource: 'categories' as const };

    /** Extracts meta from a term response */
    function getMeta(term: unknown): Record<string, unknown> {
      const t = term as { meta?: Record<string, unknown> | unknown[] };
      if (!t.meta || Array.isArray(t.meta)) return {};
      return t.meta;
    }

    it('creates a category with string meta', async () => {
      const term = await executeCreateTerm(categoryConfig, {
        name: 'Meta String Cat',
        meta: { test_term_string_meta: 'hello term meta' },
      });

      createdIds.categories.push(term.id);

      expect(getMeta(term).test_term_string_meta).toBe('hello term meta');
    });

    it('creates a category with number meta', async () => {
      const term = await executeCreateTerm(categoryConfig, {
        name: 'Meta Number Cat',
        meta: { test_term_number_meta: 42.5 },
      });

      createdIds.categories.push(term.id);

      expect(getMeta(term).test_term_number_meta).toBeCloseTo(42.5);
    });

    it('creates a category with array meta', async () => {
      const term = await executeCreateTerm(categoryConfig, {
        name: 'Meta Array Cat',
        meta: { test_term_array_meta: ['alpha', 'beta'] },
      });

      createdIds.categories.push(term.id);

      expect(getMeta(term).test_term_array_meta).toEqual(['alpha', 'beta']);
    });

    it('updates meta on an existing term', async () => {
      const created = await executeCreateTerm(categoryConfig, {
        name: 'Meta Update Cat',
        meta: { test_term_string_meta: 'before' },
      });
      createdIds.categories.push(created.id);

      const updated = await executeUpdateTerm(categoryConfig, {
        id: created.id,
        meta: { test_term_string_meta: 'after' },
      });

      expect(getMeta(updated).test_term_string_meta).toBe('after');
    });

    it('reads back meta on a fresh GET after creation', async () => {
      const term = await executeCreateTerm(categoryConfig, {
        name: 'Meta Readback Cat',
        meta: {
          test_term_string_meta: 'readback value',
          test_term_number_meta: 7.25,
        },
      });
      createdIds.categories.push(term.id);

      // Verify via a direct GET
      const res = await fetch(`${apiBase}/categories/${term.id}`, {
        headers: { Authorization: authConfig.authHeader },
      });
      const data = await res.json();

      expect(data.meta.test_term_string_meta).toBe('readback value');
      expect(data.meta.test_term_number_meta).toBeCloseTo(7.25);
    });

    it('creates a tag with meta', async () => {
      const tagConfig = { ...authConfig, resource: 'tags' as const };
      const term = await executeCreateTerm(tagConfig, {
        name: 'Meta Tag',
        meta: { test_term_string_meta: 'tag meta value' },
      });
      createdIds.tags.push(term.id);

      expect(getMeta(term).test_term_string_meta).toBe('tag meta value');
    });

    it('creates a genre with meta', async () => {
      const genreConfig = { ...authConfig, resource: 'genres' as const };
      const term = await executeCreateTerm(genreConfig, {
        name: 'Meta Genre',
        meta: { test_term_string_meta: 'genre meta value' },
      });
      createdIds.genres.push(term.id);

      expect(getMeta(term).test_term_string_meta).toBe('genre meta value');
    });
  });
});
