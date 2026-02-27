import { describe, it, expect, afterAll } from 'vitest';
import { ActionError } from 'astro/actions/runtime/server.js';
import { executeCreatePost } from '../../../src/actions/post/create';
import { executeUpdatePost } from '../../../src/actions/post/update';
import { executeDeletePost } from '../../../src/actions/post/delete';
import { createBasicAuthHeader } from '../../../src/client/auth';
import { pageSchema, contentWordPressSchema } from '../../../src/schemas';
import { getBaseUrl } from '../../helpers/wp-client';

/**
 * Integration tests for custom meta field CRUD across posts, pages, and books.
 *
 * The meta fields are registered by the mu-plugin at
 * tests/wp-env/mu-plugins/register-test-meta.php and cover all six WP meta
 * types (string, boolean, integer, number, array, object) with varied
 * auth_callback settings.
 *
 * Tests are parameterized across all three post types where applicable.
 * Dedicated sections cover complex-type edge cases, auth_callback enforcement,
 * and subtype-specific meta (book ISBN).
 */

const baseUrl = getBaseUrl();
const apiBase = `${baseUrl}/wp-json/wp/v2`;

const authHeader = createBasicAuthHeader({
  username: 'admin',
  password: process.env.WP_APP_PASSWORD!,
});

/** Configs for each post type under test */
const postTypeConfigs = {
  posts: {
    create: { apiBase, authHeader },
    update: { apiBase, authHeader },
    delete: { apiBase, authHeader },
  },
  pages: {
    create: { apiBase, authHeader, resource: 'pages' as const, responseSchema: pageSchema },
    update: { apiBase, authHeader, resource: 'pages' as const, responseSchema: pageSchema },
    delete: { apiBase, authHeader, resource: 'pages' as const },
  },
  books: {
    create: { apiBase, authHeader, resource: 'books' as const, responseSchema: contentWordPressSchema },
    update: { apiBase, authHeader, resource: 'books' as const, responseSchema: contentWordPressSchema },
    delete: { apiBase, authHeader, resource: 'books' as const },
  },
} as const;

/** Track created IDs per type for cleanup */
const createdIds: Record<string, number[]> = { posts: [], pages: [], books: [] };

afterAll(async () => {
  for (const [type, ids] of Object.entries(createdIds)) {
    const cfg = postTypeConfigs[type as keyof typeof postTypeConfigs].delete;
    for (const id of ids) {
      await executeDeletePost(cfg, { id, force: true }).catch(() => {});
    }
  }
});

/**
 * Extracts the meta object from a response.
 * WordPress returns `[]` when no registered meta keys have values set, but
 * returns a `{ key: value }` object once meta is populated.
 */
function getMeta(post: unknown): Record<string, unknown> {
  const p = post as { meta?: Record<string, unknown> | unknown[] };
  if (!p.meta || Array.isArray(p.meta)) return {};
  return p.meta;
}

/** Returns the `id` from a generic response object */
function getId(post: unknown): number {
  return (post as { id: number }).id;
}

// =============================================================================
// Per-type CRUD: parameterized across posts, pages, and books
// =============================================================================

const typeParams = [
  { typeName: 'posts' },
  { typeName: 'pages' },
  { typeName: 'books' },
] as const;

describe.each(typeParams)('Meta CRUD on $typeName', ({ typeName }) => {
  const cfg = postTypeConfigs[typeName];

  it('creates a post with all scalar meta types', async () => {
    const post = await executeCreatePost(cfg.create, {
      title: `Meta scalars (${typeName})`,
      status: 'draft',
      meta: {
        test_string_meta: 'hello world',
        test_boolean_meta: true,
        test_integer_meta: 42,
        test_number_meta: 3.14,
      },
    });

    createdIds[typeName].push(getId(post));

    const meta = getMeta(post);
    expect(meta.test_string_meta).toBe('hello world');
    expect(meta.test_boolean_meta).toBe(true);
    expect(meta.test_integer_meta).toBe(42);
    expect(meta.test_number_meta).toBeCloseTo(3.14);
  });

  it('creates a post with complex meta types (array and object)', async () => {
    const post = await executeCreatePost(cfg.create, {
      title: `Meta complex (${typeName})`,
      status: 'draft',
      meta: {
        test_array_meta: ['alpha', 'beta', 'gamma'],
        test_object_meta: { city: 'Berlin', zip: '10115', lat: 52.52, lng: 13.405 },
      },
    });

    createdIds[typeName].push(getId(post));

    const meta = getMeta(post);
    expect(meta.test_array_meta).toEqual(['alpha', 'beta', 'gamma']);
    expect(meta.test_object_meta).toEqual({
      city: 'Berlin', zip: '10115', lat: 52.52, lng: 13.405,
    });
  });

  it('reads back meta on a fresh GET after creation', async () => {
    const post = await executeCreatePost(cfg.create, {
      title: `Meta readback (${typeName})`,
      status: 'draft',
      meta: {
        test_string_meta: 'readback',
        test_integer_meta: 7,
      },
    });

    createdIds[typeName].push(getId(post));

    // Fetch the post via a plain GET to verify meta persisted
    const resource = typeName === 'posts' ? 'posts' : typeName;
    const res = await fetch(`${apiBase}/${resource}/${getId(post)}`, {
      headers: { Authorization: authHeader },
    });
    const data = await res.json();

    expect(data.meta.test_string_meta).toBe('readback');
    expect(data.meta.test_integer_meta).toBe(7);
  });

  it('updates individual meta fields without affecting others', async () => {
    const post = await executeCreatePost(cfg.create, {
      title: `Meta update (${typeName})`,
      status: 'draft',
      meta: {
        test_string_meta: 'before',
        test_integer_meta: 1,
      },
    });

    createdIds[typeName].push(getId(post));

    const updated = await executeUpdatePost(cfg.update, {
      id: getId(post),
      meta: { test_string_meta: 'after' },
    });

    const meta = getMeta(updated);
    expect(meta.test_string_meta).toBe('after');
    // Integer field should remain unchanged
    expect(meta.test_integer_meta).toBe(1);
  });

  it('replaces array meta entirely on update', async () => {
    const post = await executeCreatePost(cfg.create, {
      title: `Meta array replace (${typeName})`,
      status: 'draft',
      meta: { test_array_meta: ['one', 'two'] },
    });

    createdIds[typeName].push(getId(post));

    const updated = await executeUpdatePost(cfg.update, {
      id: getId(post),
      meta: { test_array_meta: ['three'] },
    });

    expect(getMeta(updated).test_array_meta).toEqual(['three']);
  });

  it('replaces object meta entirely on update', async () => {
    const post = await executeCreatePost(cfg.create, {
      title: `Meta object replace (${typeName})`,
      status: 'draft',
      meta: {
        test_object_meta: { city: 'Berlin', zip: '10115', lat: 52.52, lng: 13.405 },
      },
    });

    createdIds[typeName].push(getId(post));

    const updated = await executeUpdatePost(cfg.update, {
      id: getId(post),
      meta: {
        test_object_meta: { city: 'Munich', zip: '80331', lat: 48.137, lng: 11.575 },
      },
    });

    expect(getMeta(updated).test_object_meta).toEqual({
      city: 'Munich', zip: '80331', lat: 48.137, lng: 11.575,
    });
  });
});

// =============================================================================
// Array meta edge cases (tested on posts for brevity — mechanism is identical)
// =============================================================================

describe('Array meta edge cases', () => {
  const cfg = postTypeConfigs.posts;

  it('empty array', async () => {
    const post = await executeCreatePost(cfg.create, {
      title: 'Meta: empty array',
      status: 'draft',
      meta: { test_array_meta: [] },
    });

    createdIds.posts.push(getId(post));
    expect(getMeta(post).test_array_meta).toEqual([]);
  });

  it('single-item array', async () => {
    const post = await executeCreatePost(cfg.create, {
      title: 'Meta: single array',
      status: 'draft',
      meta: { test_array_meta: ['only'] },
    });

    createdIds.posts.push(getId(post));
    expect(getMeta(post).test_array_meta).toEqual(['only']);
  });

  it('preserves element order', async () => {
    const items = ['zebra', 'apple', 'mango', 'banana'];
    const post = await executeCreatePost(cfg.create, {
      title: 'Meta: array order',
      status: 'draft',
      meta: { test_array_meta: items },
    });

    createdIds.posts.push(getId(post));
    expect(getMeta(post).test_array_meta).toEqual(items);
  });

  it('clears array by setting to empty array', async () => {
    const post = await executeCreatePost(cfg.create, {
      title: 'Meta: clear array',
      status: 'draft',
      meta: { test_array_meta: ['a', 'b', 'c'] },
    });

    createdIds.posts.push(getId(post));

    const updated = await executeUpdatePost(cfg.update, {
      id: getId(post),
      meta: { test_array_meta: [] },
    });

    expect(getMeta(updated).test_array_meta).toEqual([]);
  });

  it('handles many elements', async () => {
    const items = Array.from({ length: 50 }, (_, i) => `item-${i}`);
    const post = await executeCreatePost(cfg.create, {
      title: 'Meta: large array',
      status: 'draft',
      meta: { test_array_meta: items },
    });

    createdIds.posts.push(getId(post));
    expect(getMeta(post).test_array_meta).toEqual(items);
  });
});

// =============================================================================
// Object meta edge cases
// =============================================================================

describe('Object meta edge cases', () => {
  const cfg = postTypeConfigs.posts;

  it('partial properties (only city)', async () => {
    const post = await executeCreatePost(cfg.create, {
      title: 'Meta: partial object',
      status: 'draft',
      meta: { test_object_meta: { city: 'Paris' } },
    });

    createdIds.posts.push(getId(post));

    const obj = getMeta(post).test_object_meta as Record<string, unknown>;
    expect(obj.city).toBe('Paris');
  });

  it('empty object', async () => {
    const post = await executeCreatePost(cfg.create, {
      title: 'Meta: empty object',
      status: 'draft',
      meta: { test_object_meta: {} },
    });

    createdIds.posts.push(getId(post));
    expect(getMeta(post).test_object_meta).toBeDefined();
  });

  it('all properties populated', async () => {
    const location = { city: 'Tokyo', zip: '100-0001', lat: 35.682, lng: 139.762 };
    const post = await executeCreatePost(cfg.create, {
      title: 'Meta: full object',
      status: 'draft',
      meta: { test_object_meta: location },
    });

    createdIds.posts.push(getId(post));
    expect(getMeta(post).test_object_meta).toEqual(location);
  });

  it('overwrites partial properties on update (full replace)', async () => {
    const post = await executeCreatePost(cfg.create, {
      title: 'Meta: object overwrite',
      status: 'draft',
      meta: {
        test_object_meta: { city: 'Berlin', zip: '10115', lat: 52.52, lng: 13.405 },
      },
    });

    createdIds.posts.push(getId(post));

    // Send only city — WP replaces the entire meta value
    const updated = await executeUpdatePost(cfg.update, {
      id: getId(post),
      meta: { test_object_meta: { city: 'Hamburg' } },
    });

    const obj = getMeta(updated).test_object_meta as Record<string, unknown>;
    expect(obj.city).toBe('Hamburg');
    // Other properties should be absent or default (not the old Berlin values)
    expect(obj.zip).not.toBe('10115');
  });
});

// =============================================================================
// Scalar meta edge cases
// =============================================================================

describe('Scalar meta edge cases', () => {
  const cfg = postTypeConfigs.posts;

  it('integer: zero', async () => {
    const post = await executeCreatePost(cfg.create, {
      title: 'Meta: int zero',
      status: 'draft',
      meta: { test_integer_meta: 0 },
    });

    createdIds.posts.push(getId(post));
    expect(getMeta(post).test_integer_meta).toBe(0);
  });

  it('integer: negative value', async () => {
    const post = await executeCreatePost(cfg.create, {
      title: 'Meta: int negative',
      status: 'draft',
      meta: { test_integer_meta: -999 },
    });

    createdIds.posts.push(getId(post));
    expect(getMeta(post).test_integer_meta).toBe(-999);
  });

  it('integer: large value (INT_MAX)', async () => {
    const post = await executeCreatePost(cfg.create, {
      title: 'Meta: int max',
      status: 'draft',
      meta: { test_integer_meta: 2147483647 },
    });

    createdIds.posts.push(getId(post));
    expect(getMeta(post).test_integer_meta).toBe(2147483647);
  });

  it('number: zero', async () => {
    const post = await executeCreatePost(cfg.create, {
      title: 'Meta: num zero',
      status: 'draft',
      meta: { test_number_meta: 0 },
    });

    createdIds.posts.push(getId(post));
    expect(getMeta(post).test_number_meta).toBe(0);
  });

  it('number: negative decimal', async () => {
    const post = await executeCreatePost(cfg.create, {
      title: 'Meta: num negative',
      status: 'draft',
      meta: { test_number_meta: -42.5 },
    });

    createdIds.posts.push(getId(post));
    expect(getMeta(post).test_number_meta).toBeCloseTo(-42.5);
  });

  it('number: high precision', async () => {
    const post = await executeCreatePost(cfg.create, {
      title: 'Meta: num precision',
      status: 'draft',
      meta: { test_number_meta: 1.123456789 },
    });

    createdIds.posts.push(getId(post));
    expect(getMeta(post).test_number_meta).toBeCloseTo(1.123456789, 6);
  });

  it('boolean: false', async () => {
    const post = await executeCreatePost(cfg.create, {
      title: 'Meta: bool false',
      status: 'draft',
      meta: { test_boolean_meta: false },
    });

    createdIds.posts.push(getId(post));
    expect(getMeta(post).test_boolean_meta).toBe(false);
  });

  it('string: empty string', async () => {
    const post = await executeCreatePost(cfg.create, {
      title: 'Meta: str empty',
      status: 'draft',
      meta: { test_string_meta: '' },
    });

    createdIds.posts.push(getId(post));
    expect(getMeta(post).test_string_meta).toBe('');
  });

  it('string: unicode and special characters', async () => {
    const value = '日本語 émojis 🎉 <script>alert("xss")</script>';
    const post = await executeCreatePost(cfg.create, {
      title: 'Meta: str unicode',
      status: 'draft',
      meta: { test_string_meta: value },
    });

    createdIds.posts.push(getId(post));
    expect(getMeta(post).test_string_meta).toBe(value);
  });
});

// =============================================================================
// Auth callback enforcement
// =============================================================================

describe('Meta auth_callback enforcement', () => {
  const cfg = postTypeConfigs.posts;

  it('readonly meta field write is rejected by WordPress', async () => {
    // test_readonly_meta has auth_callback: __return_false
    // WordPress should return 403 when the request includes a field the user cannot write.
    await expect(
      executeCreatePost(cfg.create, {
        title: 'Meta: readonly reject',
        status: 'draft',
        meta: { test_readonly_meta: 'should not save' },
      })
    ).rejects.toThrow(ActionError);
  });

  it('readonly meta field default is visible on read', async () => {
    // Create without touching the readonly field — it should appear with its default
    const post = await executeCreatePost(cfg.create, {
      title: 'Meta: readonly default',
      status: 'draft',
      meta: { test_string_meta: 'writable value' },
    });

    createdIds.posts.push(getId(post));

    const meta = getMeta(post);
    expect(meta.test_readonly_meta).toBe('immutable');
    expect(meta.test_string_meta).toBe('writable value');
  });

  it('cap-gated meta fields work for admin user', async () => {
    // test_boolean_meta (edit_posts), test_integer_meta (publish_posts),
    // test_object_meta (edit_published_posts) — admin has all capabilities
    const post = await executeCreatePost(cfg.create, {
      title: 'Meta: cap gated admin',
      status: 'draft',
      meta: {
        test_boolean_meta: true,
        test_integer_meta: 100,
        test_object_meta: { city: 'Tokyo', zip: '100-0001', lat: 35.682, lng: 139.762 },
      },
    });

    createdIds.posts.push(getId(post));

    const meta = getMeta(post);
    expect(meta.test_boolean_meta).toBe(true);
    expect(meta.test_integer_meta).toBe(100);
    expect(meta.test_object_meta).toEqual({
      city: 'Tokyo', zip: '100-0001', lat: 35.682, lng: 139.762,
    });
  });

  it('unregistered meta key is silently ignored', async () => {
    const post = await executeCreatePost(cfg.create, {
      title: 'Meta: unregistered key',
      status: 'draft',
      meta: {
        test_string_meta: 'registered',
        nonexistent_meta_key_xyz: 'should be ignored',
      },
    });

    createdIds.posts.push(getId(post));

    const meta = getMeta(post);
    expect(meta.test_string_meta).toBe('registered');
    expect(meta).not.toHaveProperty('nonexistent_meta_key_xyz');
  });
});

// =============================================================================
// Subtype-specific meta (book ISBN)
// =============================================================================

describe('Subtype-specific meta (book ISBN)', () => {
  it('book ISBN meta is writable on books', async () => {
    const cfg = postTypeConfigs.books;
    const book = await executeCreatePost(cfg.create, {
      title: 'Meta: book with ISBN',
      status: 'draft',
      meta: { test_book_isbn: '978-3-16-148410-0' },
    });

    createdIds.books.push(getId(book));

    expect(getMeta(book).test_book_isbn).toBe('978-3-16-148410-0');
  });

  it('book ISBN meta can be updated', async () => {
    const cfg = postTypeConfigs.books;
    const book = await executeCreatePost(cfg.create, {
      title: 'Meta: book ISBN update',
      status: 'draft',
      meta: { test_book_isbn: '978-0-00-000000-0' },
    });

    createdIds.books.push(getId(book));

    const updated = await executeUpdatePost(cfg.update, {
      id: getId(book),
      meta: { test_book_isbn: '978-1-23-456789-0' },
    });

    expect(getMeta(updated).test_book_isbn).toBe('978-1-23-456789-0');
  });

  it('book ISBN meta is not present on standard posts', async () => {
    const post = await executeCreatePost(postTypeConfigs.posts.create, {
      title: 'Meta: post no ISBN',
      status: 'draft',
      meta: { test_string_meta: 'valid' },
    });

    createdIds.posts.push(getId(post));

    expect(getMeta(post)).not.toHaveProperty('test_book_isbn');
  });

  it('book ISBN meta is not present on pages', async () => {
    const page = await executeCreatePost(postTypeConfigs.pages.create, {
      title: 'Meta: page no ISBN',
      status: 'draft',
      meta: { test_string_meta: 'valid' },
    });

    createdIds.pages.push(getId(page));

    expect(getMeta(page)).not.toHaveProperty('test_book_isbn');
  });
});
