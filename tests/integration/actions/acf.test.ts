import { describe, it, expect, afterAll } from 'vitest';
import { ActionError } from 'astro/actions/runtime/server.js';
import { executeCreatePost } from '../../../src/actions/post/create';
import { executeUpdatePost } from '../../../src/actions/post/update';
import { executeDeletePost } from '../../../src/actions/post/delete';
import { createBasicAuthHeader } from '../../../src/client/auth';
import { pageSchema, contentWordPressSchema } from '../../../src/schemas';
import { getBaseUrl } from '../../helpers/wp-client';

/**
 * Integration tests for ACF field CRUD across posts, pages, and books.
 *
 * The ACF field group is registered by
 * tests/wp-env/mu-plugins/register-acf-fields.php and seeded by
 * tests/wp-env/seed-content.php.
 *
 * Fields under test:
 *   - acf_subtitle          (text)
 *   - acf_summary           (textarea)
 *   - acf_priority_score    (number 0–100)
 *   - acf_external_url      (url)
 *   - acf_related_posts     (relationship; REST value is an array of post IDs)
 *   - acf_featured_post     (post_object; REST value is a single post ID)
 *
 * When endpoints are fetched with `_embed=1`, ACF relationship references are
 * additionally exposed via `_links['acf:post']` and `_embedded['acf:post']`.
 */

const baseUrl = getBaseUrl();
const apiBase = `${baseUrl}/wp-json/wp/v2`;

const authHeader = createBasicAuthHeader({
  username: 'admin',
  password: process.env.WP_APP_PASSWORD!,
});

/** Post type configs shared across helpers */
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

/** Track created IDs per type for afterAll cleanup */
const createdIds: Record<string, number[]> = { posts: [], pages: [], books: [] };

afterAll(async () => {
  for (const [type, ids] of Object.entries(createdIds)) {
    const cfg = postTypeConfigs[type as keyof typeof postTypeConfigs].delete;
    for (const id of ids) {
      await executeDeletePost(cfg, { id, force: true }).catch(() => {});
    }
  }
});

/** Extracts the acf object from a REST response. */
function getAcf(post: unknown): Record<string, unknown> {
  const p = post as { acf?: Record<string, unknown> | unknown[] };
  if (!p.acf || Array.isArray(p.acf)) return {};
  return p.acf;
}

/** Returns the numeric id from a generic REST response object. */
function getId(post: unknown): number {
  return (post as { id: number }).id;
}

type ResourceType = 'posts' | 'pages' | 'books';

/** Pattern for a valid WP REST API path pointing to a posts resource. */
const wpRestPostPathPattern = /\/wp-json\/wp\/v2\/posts\/\d+$/;

/** Fetches one seeded resource by slug, optionally with _embed enabled. */
async function fetchResourceBySlug(resource: ResourceType, slug: string, embed: boolean = false): Promise<Record<string, unknown>> {
  const url = new URL(`${apiBase}/${resource}`);
  url.searchParams.set('slug', slug);
  if (embed) {
    url.searchParams.set('_embed', '1');
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: authHeader },
  });

  const data = await res.json() as Array<Record<string, unknown>>;
  const [entry] = data;

  if (!entry) {
    throw new Error(`Expected ${resource} with slug '${slug}' to exist in seeded data.`);
  }

  return entry;
}

/** Fetches one resource by ID, optionally with _embed enabled. */
async function fetchResourceById(resource: ResourceType, id: number, embed: boolean = false): Promise<Record<string, unknown>> {
  const url = new URL(`${apiBase}/${resource}/${id}`);
  if (embed) {
    url.searchParams.set('_embed', '1');
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: authHeader },
  });

  if (!res.ok) {
    throw new Error(`Expected ${resource}/${id} to exist. Received ${res.status}.`);
  }

  return await res.json() as Record<string, unknown>;
}

/** Resolves a post ID from a seeded post slug. */
async function getPostIdBySlug(slug: string): Promise<number> {
  const post = await fetchResourceBySlug('posts', slug);
  return getId(post);
}

/** Extracts referenced post IDs from the ACF relation links in _links['acf:post']. */
function getAcfLinkedPostIds(resource: Record<string, unknown>): number[] {
  const links = (resource._links as Record<string, unknown> | undefined)?.['acf:post'];
  if (!Array.isArray(links)) {
    return [];
  }

  const ids: number[] = [];
  for (const link of links as Array<{ href?: string }>) {
    const href = link?.href;
    if (!href) {
      continue;
    }

    const url = new URL(href);
    expect(wpRestPostPathPattern.test(url.pathname)).toBe(true);

    const idSegment = url.pathname.split('/').pop();
    const id = Number(idSegment);
    if (Number.isInteger(id) && id > 0) {
      ids.push(id);
    }
  }

  return ids;
}

/** Extracts referenced post IDs from _embedded['acf:post']. */
function getAcfEmbeddedPostIds(resource: Record<string, unknown>): number[] {
  const embedded = (resource._embedded as Record<string, unknown> | undefined)?.['acf:post'];
  if (!Array.isArray(embedded)) {
    return [];
  }

  return (embedded as Array<{ id?: number }>)
    .map((entry) => entry.id)
    .filter((id): id is number => typeof id === 'number');
}

/**
 * Asserts that both _links and _embedded include the expected related post IDs.
 *
 * Order is not guaranteed by WordPress, so assertions are set-based.
 */
function expectAcfLinksAndEmbeddedToContain(resource: Record<string, unknown>, expectedPostIds: number[]): void {
  const linkIds = getAcfLinkedPostIds(resource);
  const embeddedIds = getAcfEmbeddedPostIds(resource);

  expect(linkIds).toEqual(expect.arrayContaining(expectedPostIds));
  expect(embeddedIds).toEqual(expect.arrayContaining(expectedPostIds));
}

// =============================================================================
// Seeded data — read-only assertions on known seed content
// =============================================================================

describe('Seeded ACF scalar fields on posts', () => {
  it.each([
    {
      slug: 'test-post-001',
      subtitle: 'Subtitle for test post 001',
      summary: 'Summary content for test post 001. Deterministic seed data.',
      priority: 10,
      url: 'https://example.com/test-post-001',
    },
    {
      slug: 'test-post-002',
      subtitle: 'Subtitle for test post 002',
      summary: 'Summary content for test post 002. Deterministic seed data.',
      priority: 20,
      url: 'https://example.com/test-post-002',
    },
    {
      slug: 'test-post-003',
      subtitle: 'Subtitle for test post 003',
      summary: 'Summary content for test post 003. Deterministic seed data.',
      priority: 30,
      url: 'https://example.com/test-post-003',
    },
  ])('$slug has correct scalar ACF fields', async ({ slug, subtitle, summary, priority, url }) => {
    const post = await fetchResourceBySlug('posts', slug);
    const acf = getAcf(post);

    expect(acf.acf_subtitle).toBe(subtitle);
    expect(acf.acf_summary).toBe(summary);
    expect(acf.acf_priority_score).toBe(priority);
    expect(acf.acf_external_url).toBe(url);
  });
});

describe('Seeded ACF relation fields on posts', () => {
  it.each([
    {
      slug: 'test-post-001',
      expectedRelatedSlugs: ['test-post-002', 'test-post-003'],
      expectedFeaturedSlug: 'test-post-011',
    },
    {
      slug: 'test-post-002',
      expectedRelatedSlugs: ['test-post-003', 'test-post-004'],
      expectedFeaturedSlug: 'test-post-012',
    },
    {
      slug: 'test-post-003',
      expectedRelatedSlugs: ['test-post-004', 'test-post-005'],
      expectedFeaturedSlug: 'test-post-013',
    },
  ])('$slug returns relation IDs and embeds relation links when fetched with _embed', async ({
    slug,
    expectedRelatedSlugs,
    expectedFeaturedSlug,
  }) => {
    const post = await fetchResourceBySlug('posts', slug, true);
    const acf = getAcf(post);
    const related = acf.acf_related_posts;

    expect(Array.isArray(related)).toBe(true);
    expect((related as unknown[]).length).toBe(expectedRelatedSlugs.length);

    const relatedIds = related as number[];
    for (const relatedId of relatedIds) {
      expect(typeof relatedId).toBe('number');
    }

    const expectedRelatedIds = await Promise.all(expectedRelatedSlugs.map((item) => getPostIdBySlug(item)));
    expect(relatedIds).toEqual(expect.arrayContaining(expectedRelatedIds));

    const expectedFeaturedId = await getPostIdBySlug(expectedFeaturedSlug);
    expect(acf.acf_featured_post).toBe(expectedFeaturedId);

    expectAcfLinksAndEmbeddedToContain(post, [...expectedRelatedIds, expectedFeaturedId]);
  });
});

describe('Seeded ACF fields on pages', () => {
  it.each([
    { slug: 'about',   subtitle: 'Subtitle for about page',   priority: 20, url: 'https://example.com/about' },
    { slug: 'contact', subtitle: 'Subtitle for contact page', priority: 40, url: 'https://example.com/contact' },
  ])('$slug page has correct scalar ACF fields', async ({ slug, subtitle, priority, url }) => {
    const page = await fetchResourceBySlug('pages', slug);
    const acf = getAcf(page);

    expect(acf.acf_subtitle).toBe(subtitle);
    expect(acf.acf_priority_score).toBe(priority);
    expect(acf.acf_external_url).toBe(url);
  });

  it('about page returns related post IDs and relation links when fetched with _embed', async () => {
    const page = await fetchResourceBySlug('pages', 'about', true);
    const related = getAcf(page).acf_related_posts as number[];
    const expectedRelatedIds = await Promise.all([
      getPostIdBySlug('test-post-001'),
      getPostIdBySlug('test-post-002'),
    ]);

    expect(Array.isArray(related)).toBe(true);
    expect(related).toHaveLength(expectedRelatedIds.length);
    expect(related).toEqual(expect.arrayContaining(expectedRelatedIds));
    expect(getAcf(page).acf_featured_post).toBeNull();

    expectAcfLinksAndEmbeddedToContain(page, expectedRelatedIds);
  });
});

describe('Seeded ACF fields on books', () => {
  it.each([
    { slug: 'test-book-001', priority: 15, featuredSlug: 'test-post-005' },
    { slug: 'test-book-002', priority: 30, featuredSlug: 'test-post-010' },
  ])('$slug has correct scalar fields and relation IDs', async ({ slug, priority, featuredSlug }) => {
    const book = await fetchResourceBySlug('books', slug, true);
    const acf = getAcf(book);

    expect(acf.acf_priority_score).toBe(priority);
    expect(typeof acf.acf_subtitle).toBe('string');
    expect(acf.acf_related_posts).toBeNull();

    const expectedFeaturedId = await getPostIdBySlug(featuredSlug);
    expect(acf.acf_featured_post).toBe(expectedFeaturedId);

    expectAcfLinksAndEmbeddedToContain(book, [expectedFeaturedId]);
  });
});

// =============================================================================
// CRUD — create with ACF fields
// =============================================================================

describe('Create post with ACF scalar fields', () => {
  it('creates a post with scalar ACF fields and reads them back from the response', async () => {
    const post = await executeCreatePost(postTypeConfigs.posts.create, {
      title: 'ACF CRUD: scalar create',
      status: 'draft',
      acf: {
        acf_subtitle: 'My subtitle',
        acf_summary: 'My summary text',
        acf_priority_score: 55,
        acf_external_url: 'https://example.com/crud',
      },
    });

    createdIds.posts.push(getId(post));
    const acf = getAcf(post);

    expect(acf.acf_subtitle).toBe('My subtitle');
    expect(acf.acf_summary).toBe('My summary text');
    expect(acf.acf_priority_score).toBe(55);
    expect(acf.acf_external_url).toBe('https://example.com/crud');
  });

  it('creates a page with scalar ACF fields', async () => {
    const page = await executeCreatePost(postTypeConfigs.pages.create, {
      title: 'ACF CRUD: page scalars',
      status: 'draft',
      acf: {
        acf_subtitle: 'Page subtitle',
        acf_priority_score: 75,
      },
    });

    createdIds.pages.push(getId(page));
    const acf = getAcf(page);

    expect(acf.acf_subtitle).toBe('Page subtitle');
    expect(acf.acf_priority_score).toBe(75);
  });

  it('creates a book with scalar ACF fields', async () => {
    const book = await executeCreatePost(postTypeConfigs.books.create, {
      title: 'ACF CRUD: book scalars',
      status: 'draft',
      acf: {
        acf_subtitle: 'Book subtitle',
        acf_priority_score: 90,
      },
    });

    createdIds.books.push(getId(book));
    const acf = getAcf(book);

    expect(acf.acf_subtitle).toBe('Book subtitle');
    expect(acf.acf_priority_score).toBe(90);
  });
});

describe('Create post with ACF relationship field', () => {
  it('returns acf_related_posts as numeric post IDs', async () => {
    const [relatedId1, relatedId2] = await Promise.all([
      getPostIdBySlug('test-post-001'),
      getPostIdBySlug('test-post-002'),
    ]);

    const post = await executeCreatePost(postTypeConfigs.posts.create, {
      title: 'ACF CRUD: relationship create',
      status: 'draft',
      acf: {
        acf_related_posts: [relatedId1, relatedId2],
      },
    });

    createdIds.posts.push(getId(post));
    const related = getAcf(post).acf_related_posts as number[];

    expect(Array.isArray(related)).toBe(true);
    expect(related).toHaveLength(2);
    expect(related).toEqual(expect.arrayContaining([relatedId1, relatedId2]));

    for (const relatedId of related) {
      expect(typeof relatedId).toBe('number');
    }
  });

  it('exposes relation links and embedded relation data when the entry is fetched with _embed', async () => {
    const [relatedId1, relatedId2, featuredId] = await Promise.all([
      getPostIdBySlug('test-post-003'),
      getPostIdBySlug('test-post-004'),
      getPostIdBySlug('test-post-020'),
    ]);

    const post = await executeCreatePost(postTypeConfigs.posts.create, {
      title: 'ACF CRUD: relationship embed readback',
      status: 'draft',
      acf: {
        acf_related_posts: [relatedId1, relatedId2],
        acf_featured_post: featuredId,
      },
    });

    createdIds.posts.push(getId(post));

    const readBack = await fetchResourceById('posts', getId(post), true);
    expect(getAcf(readBack).acf_related_posts).toEqual(expect.arrayContaining([relatedId1, relatedId2]));
    expect(getAcf(readBack).acf_featured_post).toBe(featuredId);

    expectAcfLinksAndEmbeddedToContain(readBack, [relatedId1, relatedId2, featuredId]);
  });
});

describe('Create post with ACF post_object field', () => {
  it('returns acf_featured_post as a numeric post ID', async () => {
    const targetId = await getPostIdBySlug('test-post-005');

    const post = await executeCreatePost(postTypeConfigs.posts.create, {
      title: 'ACF CRUD: post_object create',
      status: 'draft',
      acf: { acf_featured_post: targetId },
    });

    createdIds.posts.push(getId(post));
    const featured = getAcf(post).acf_featured_post;

    expect(featured).toBe(targetId);
  });
});

// =============================================================================
// CRUD — update ACF fields
// =============================================================================

describe('Update ACF scalar fields', () => {
  it('updates scalar ACF fields without disturbing unrelated fields', async () => {
    const post = await executeCreatePost(postTypeConfigs.posts.create, {
      title: 'ACF CRUD: scalar update base',
      status: 'draft',
      acf: {
        acf_subtitle: 'original subtitle',
        acf_priority_score: 10,
      },
    });

    createdIds.posts.push(getId(post));

    const updated = await executeUpdatePost(postTypeConfigs.posts.update, {
      id: getId(post),
      acf: { acf_subtitle: 'updated subtitle' },
    });

    const acf = getAcf(updated);
    expect(acf.acf_subtitle).toBe('updated subtitle');
    // Priority was not touched — should remain 10
    expect(acf.acf_priority_score).toBe(10);
  });

  it('updates acf_external_url to a new value', async () => {
    const post = await executeCreatePost(postTypeConfigs.posts.create, {
      title: 'ACF CRUD: url update',
      status: 'draft',
      acf: { acf_external_url: 'https://before.example.com' },
    });

    createdIds.posts.push(getId(post));

    const updated = await executeUpdatePost(postTypeConfigs.posts.update, {
      id: getId(post),
      acf: { acf_external_url: 'https://after.example.com' },
    });

    expect(getAcf(updated).acf_external_url).toBe('https://after.example.com');
  });
});

describe('Update ACF relationship field', () => {
  it('replaces acf_related_posts with a different set of IDs', async () => {
    const [id1, id2, id3] = await Promise.all([
      getPostIdBySlug('test-post-001'),
      getPostIdBySlug('test-post-002'),
      getPostIdBySlug('test-post-010'),
    ]);

    const post = await executeCreatePost(postTypeConfigs.posts.create, {
      title: 'ACF CRUD: relationship update',
      status: 'draft',
      acf: { acf_related_posts: [id1, id2] },
    });

    createdIds.posts.push(getId(post));

    const updated = await executeUpdatePost(postTypeConfigs.posts.update, {
      id: getId(post),
      acf: { acf_related_posts: [id3] },
    });

    const related = getAcf(updated).acf_related_posts as number[];
    expect(related).toHaveLength(1);
    expect(related[0]).toBe(id3);
  });

  it('rejects clearing acf_related_posts with an empty array', async () => {
    const targetId = await getPostIdBySlug('test-post-001');

    const post = await executeCreatePost(postTypeConfigs.posts.create, {
      title: 'ACF CRUD: relationship clear',
      status: 'draft',
      acf: { acf_related_posts: [targetId] },
    });

    createdIds.posts.push(getId(post));

    await expect(
      executeUpdatePost(postTypeConfigs.posts.update, {
        id: getId(post),
        acf: { acf_related_posts: [] },
      })
    ).rejects.toThrow(ActionError);
  });

  it('returns relation link and embed data after relation updates when fetched with _embed', async () => {
    const [relatedId, featuredId] = await Promise.all([
      getPostIdBySlug('test-post-031'),
      getPostIdBySlug('test-post-040'),
    ]);

    const post = await executeCreatePost(postTypeConfigs.posts.create, {
      title: 'ACF CRUD: relationship embed update',
      status: 'draft',
      acf: { acf_related_posts: [relatedId] },
    });

    createdIds.posts.push(getId(post));

    await executeUpdatePost(postTypeConfigs.posts.update, {
      id: getId(post),
      acf: {
        acf_related_posts: [relatedId],
        acf_featured_post: featuredId,
      },
    });

    const readBack = await fetchResourceById('posts', getId(post), true);
    expect(getAcf(readBack).acf_related_posts).toEqual(expect.arrayContaining([relatedId]));
    expect(getAcf(readBack).acf_featured_post).toBe(featuredId);

    expectAcfLinksAndEmbeddedToContain(readBack, [relatedId, featuredId]);
  });
});

describe('Update ACF post_object field', () => {
  it('replaces acf_featured_post with a different post', async () => {
    const [id1, id2] = await Promise.all([
      getPostIdBySlug('test-post-001'),
      getPostIdBySlug('test-post-020'),
    ]);

    const post = await executeCreatePost(postTypeConfigs.posts.create, {
      title: 'ACF CRUD: post_object update',
      status: 'draft',
      acf: { acf_featured_post: id1 },
    });

    createdIds.posts.push(getId(post));

    const updated = await executeUpdatePost(postTypeConfigs.posts.update, {
      id: getId(post),
      acf: { acf_featured_post: id2 },
    });

    expect(getAcf(updated).acf_featured_post).toBe(id2);
  });
});

// =============================================================================
// Auth enforcement
// =============================================================================

describe('ACF auth enforcement', () => {
  it('unauthenticated create with ACF fields throws ActionError', async () => {
    const unauthConfig = { apiBase, authHeader: '' };

    await expect(
      executeCreatePost(unauthConfig, {
        title: 'ACF: unauth create',
        status: 'draft',
        acf: { acf_subtitle: 'should fail' },
      })
    ).rejects.toThrow(ActionError);
  });
});
