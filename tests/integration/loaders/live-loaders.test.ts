import { createJwtAuthHeader, WordPressClient } from 'fluent-wp-client';
import { assert, beforeAll, describe, expect, it } from 'vitest';

import {
  wordPressCategoryLoader,
  wordPressContentLoader,
  wordPressMediaLoader,
  wordPressPageLoader,
  wordPressPostLoader,
  wordPressTagLoader,
  wordPressTermLoader,
  wordPressUserLoader,
} from '../../../src/loaders/live';
import { getAcfChoiceLabels } from '../../helpers/acf-choice-catalog';
import { getBaseUrl } from '../../helpers/wp-client';

/**
 * Legacy helper method keys from fluent-wp-client v1 content wrappers.
 */
const LEGACY_CONTENT_METHOD_KEYS = [
  'get',
  'getContent',
  'getBlocks',
  'then',
] as const;

/**
 * Asserts one live loader record data object is plain and serialization-safe.
 */
// oxlint-disable-next-line anti-slop/no-unsafe-dictionary-type -- The serialization assertion must inspect every field of a WordPress record.
function expectSerializableContentData(data: Record<string, unknown>): void {
  for (const value of Object.values(data)) {
    expect(value).not.toBeTypeOf('function');
  }

  for (const key of LEGACY_CONTENT_METHOD_KEYS) {
    expect(Object.hasOwn(data, key)).toBeFalsy();
  }
}

/**
 * Astro live-loader integration focused on loader contract behavior.
 *
 * This suite verifies wrapper-level guarantees (entry shape, rendered content,
 * filter normalization, and error-object results) rather than broad REST
 * endpoint semantics already covered by the client package.
 */
describe('Live Loaders', () => {
  let baseUrl: string;

  beforeAll(() => {
    baseUrl = getBaseUrl();
  });

  /**
   * Creates one public client for loader tests that do not require auth.
   */
  function createPublicClient(): WordPressClient {
    return new WordPressClient({ baseUrl });
  }

  /**
   * Creates one client with request-aware headers for authenticated loader tests.
   */
  function createJwtClient(): WordPressClient {
    return new WordPressClient({
      authHeaders: ({ method }) => {
        if (method !== 'GET') {
          throw new Error('Expected GET for live loader auth test.');
        }

        return {
          Authorization: createJwtAuthHeader(process.env.WP_JWT_TOKEN!),
        };
      },
      baseUrl,
    });
  }

  describe(wordPressPostLoader, () => {
    it('returns Astro live-collection entries with string IDs and rendered html', async () => {
      const loader = wordPressPostLoader(createPublicClient());

      const result = await loader.loadCollection({
        collection: 'test',
        filter: undefined,
      });

      assert(result && 'entries' in result);

      expect(Array.isArray(result.entries)).toBeTruthy();
      expect(result.entries.length).toBeGreaterThan(0);

      const first = result.entries[0];
      expect(first.id).toBeTypeOf('string');
      expect(first.id).toBe(String(first.data.id));
      expect(first.rendered?.html).toBe(first.data.content.rendered);
    });

    it('returns plain data objects suitable for serialization', async () => {
      const loader = wordPressPostLoader(createPublicClient());

      const result = await loader.loadCollection({
        collection: 'test',
        filter: undefined,
      });

      assert(result && 'entries' in result);

      expect(result.entries.length).toBeGreaterThan(0);

      for (const entry of result.entries) {
        expectSerializableContentData(entry.data);
      }
    });

    it('normalizes nested Astro filter input for loadEntry', async () => {
      const loader = wordPressPostLoader(createPublicClient());

      // SAFETY: This regression test deliberately sends Astro's legacy wrapped filter shape.
      const result = await loader.loadEntry({
        collection: 'test',
        filter: { filter: { slug: 'test-post-001' } },
      } as never);

      assert(result && 'data' in result);

      expect(result.data.slug).toBe('test-post-001');
      expect(result.rendered?.html).toBe(result.data.content.rendered);
    });

    it('loads embedded relations only when embed is explicitly enabled', async () => {
      const loader = wordPressPostLoader(createPublicClient(), { embed: true });

      const result = await loader.loadEntry({
        collection: 'test',
        filter: { slug: 'test-post-001' },
      });

      assert(result && 'data' in result);

      expect(result.data._embedded).toBeDefined();
    });

    it('maps returned entry data with site-specific field labels', async () => {
      const loader = wordPressPostLoader(createPublicClient(), {
        mapEntry: (entry, context) => ({
          ...entry,
          acf: {
            // oxlint-disable-next-line anti-slop/no-runtime-typeof -- ACF may return an empty array; preserve existing fields only when an object is available.
            ...(typeof entry.acf === 'object' && entry.acf !== null
              ? entry.acf
              : undefined),
            acf_subtitle: `${context.resource}:Mapped label`,
          },
        }),
      });

      const result = await loader.loadEntry({
        collection: 'test',
        filter: { slug: 'test-post-001' },
      });

      assert(result && 'data' in result);

      assert(!Array.isArray(result.data.acf));
      expect(result.data.acf?.acf_subtitle).toBe('posts:Mapped label');
    });

    it('supports callback-driven ACF choice labels from live REST API', async () => {
      const choiceLabels = await getAcfChoiceLabels(baseUrl);

      const loader = wordPressPostLoader(createPublicClient(), {
        mapEntry: (entry) => ({
          ...entry,
          acf: {
            // oxlint-disable-next-line anti-slop/no-runtime-typeof -- ACF may return an empty array; preserve existing fields only when an object is available.
            ...(typeof entry.acf === 'object' && entry.acf !== null
              ? entry.acf
              : undefined),
            acf_project_status:
              choiceLabels
                .get('acf_project_status')
                ?.get(
                  String(
                    Array.isArray(entry.acf)
                      ? undefined
                      : entry.acf?.acf_project_status
                  )
                ) ??
              (Array.isArray(entry.acf)
                ? undefined
                : entry.acf?.acf_project_status),
          },
        }),
      });

      const result = await loader.loadEntry({
        collection: 'test',
        filter: { slug: 'test-post-001' },
      });

      assert(result && 'data' in result);

      assert(!Array.isArray(result.data.acf));
      expect(result.data.acf?.acf_project_status).toBe('In progress');
    });

    it('returns cache hints with lastModified and relationship tags', async () => {
      const loader = wordPressPostLoader(createPublicClient());

      const result = await loader.loadEntry({
        collection: 'test',
        filter: { slug: 'test-post-001' },
      });

      assert(result && 'data' in result);

      expect(result.cacheHint?.lastModified).toBeInstanceOf(Date);
      expect(result.cacheHint?.tags).toContain(
        `wp:entry:posts:${result.data.id}`
      );
      expect(result.cacheHint?.tags).toContain(
        `wp:author:${result.data.author}`
      );
      expect(result.cacheHint?.tags).toContain(
        `wp:term:category:${result.data.categories?.[0]}`
      );
      expect(result.cacheHint?.tags).toContain(
        `wp:term:post_tag:${result.data.tags?.[0]}`
      );
    });

    it('returns collection cache hints with the newest lastModified', async () => {
      const loader = wordPressPostLoader(createPublicClient());

      const result = await loader.loadCollection({
        collection: 'test',
        filter: undefined,
      });

      assert(result && 'entries' in result);

      const expectedLastModified = result.entries
        .map((entry) => new Date(entry.data.modified_gmt))
        .toSorted((left, right) => right.getTime() - left.getTime())[0];

      expect(result.cacheHint?.lastModified?.toISOString()).toBe(
        expectedLastModified.toISOString()
      );
      expect(result.cacheHint?.tags).toContain('wp:resource:posts');
    });

    it('forwards pagination filters for listing-style reads', async () => {
      const loader = wordPressPostLoader(createPublicClient());

      const result = await loader.loadCollection({
        collection: 'test',
        filter: { order: 'asc', orderby: 'slug', page: 1, perPage: 20 },
      });

      assert(result && 'entries' in result);

      expect(result.entries).toHaveLength(20);
      expect(result.entries[0].data.slug).toBe('test-post-001');
    });

    it('forwards search filter and returns only matching posts', async () => {
      const loader = wordPressPostLoader(createPublicClient());

      const result = await loader.loadCollection({
        collection: 'test',
        filter: { search: 'Test Post 001' },
      });

      assert(result && 'entries' in result);

      expect(result.entries.length).toBeGreaterThan(0);
      expect(
        result.entries.some((e) => e.data.slug === 'test-post-001')
      ).toBeTruthy();
      expect(result.cacheHint).toBeUndefined();
      expect(result.entries[0].cacheHint?.tags).toContain(
        `wp:entry:posts:${result.entries[0].data.id}`
      );
    });

    it('forwards include filter and returns only the specified posts', async () => {
      const loader = wordPressPostLoader(createPublicClient());

      // First fetch by slug to get the numeric id
      const entry = await loader.loadEntry({
        collection: 'test',
        filter: { slug: 'test-post-001' },
      });

      assert(entry && 'data' in entry);

      const { id } = entry.data;

      const result = await loader.loadCollection({
        collection: 'test',
        filter: { include: [id] },
      });

      assert(result && 'entries' in result);

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].data.id).toBe(id);
    });

    it('forwards exclude filter and omits the specified post', async () => {
      const loader = wordPressPostLoader(createPublicClient());

      const entry = await loader.loadEntry({
        collection: 'test',
        filter: { slug: 'test-post-001' },
      });

      assert(entry && 'data' in entry);

      const { id } = entry.data;

      const result = await loader.loadCollection({
        collection: 'test',
        filter: { exclude: [id], perPage: 20 },
      });

      assert(result && 'entries' in result);

      expect(result.entries.every((e) => e.data.id !== id)).toBeTruthy();
    });

    it('forwards upstream slug collection filter without treating it as lookup-only', async () => {
      const loader = wordPressPostLoader(createPublicClient());

      const result = await loader.loadCollection({
        collection: 'test',
        filter: { slug: ['test-post-001'] },
      });

      assert(result && 'entries' in result);

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].data.slug).toBe('test-post-001');
    });

    it('returns one error object for missing entries', async () => {
      const loader = wordPressPostLoader(createPublicClient());

      const result = await loader.loadEntry({
        collection: 'test',
        filter: { slug: 'definitely-no-post' },
      });

      assert(result && 'error' in result);

      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toContain('Post not found');
    });

    it('returns one error object for unauthorized collection access', async () => {
      const loader = wordPressPostLoader(createPublicClient());

      const result = await loader.loadCollection({
        collection: 'test',
        filter: { status: 'draft' },
      });

      assert(result && 'error' in result);

      expect(result.error).toBeInstanceOf(Error);
    });

    it('accepts request-aware auth headers when loading protected content', async () => {
      const loader = wordPressPostLoader(createJwtClient());

      const result = await loader.loadCollection({
        collection: 'test',
        filter: { status: 'draft' },
      });

      assert(result && 'entries' in result);

      expect(Array.isArray(result.entries)).toBeTruthy();
    });

    it('uses the client fetch override for live loader reads', async () => {
      let requestCount = 0;

      const loader = wordPressPostLoader(
        new WordPressClient({
          baseUrl,
          fetch: async (input, init) => {
            requestCount += 1;

            return fetch(input, init);
          },
        })
      );

      const result = await loader.loadEntry({
        collection: 'test',
        filter: { slug: 'test-post-001' },
      });

      assert(result && 'data' in result);

      expect(result.data?.slug).toBe('test-post-001');
      expect(requestCount).toBeGreaterThan(0);
    });
  });

  describe(wordPressPageLoader, () => {
    it('includes rendered html for page entries', async () => {
      const loader = wordPressPageLoader(createPublicClient());

      const result = await loader.loadEntry({
        collection: 'test',
        filter: { slug: 'about' },
      });

      assert(result && 'data' in result);

      expect(result.rendered?.html).toBe(result.data.content.rendered);
    });

    it('returns plain data objects suitable for serialization', async () => {
      const loader = wordPressPageLoader(createPublicClient());

      const result = await loader.loadCollection({
        collection: 'test',
        filter: undefined,
      });

      assert(result && 'entries' in result);

      expect(result.entries.length).toBeGreaterThan(0);

      for (const entry of result.entries) {
        expectSerializableContentData(entry.data);
      }
    });

    it('returns cache hints with page timestamps and author tags', async () => {
      const loader = wordPressPageLoader(createPublicClient());

      const result = await loader.loadEntry({
        collection: 'test',
        filter: { slug: 'about' },
      });

      assert(result && 'data' in result);

      expect(result.cacheHint?.lastModified).toBeInstanceOf(Date);
      expect(result.cacheHint?.tags).toContain(
        `wp:entry:pages:${result.data.id}`
      );
      expect(result.cacheHint?.tags).toContain(
        `wp:author:${result.data.author}`
      );
    });
  });

  describe(wordPressCategoryLoader, () => {
    it('returns taxonomy entries without rendered html blocks', async () => {
      const loader = wordPressCategoryLoader(createPublicClient());

      const result = await loader.loadCollection({
        collection: 'test',
        filter: undefined,
      });

      assert(result && 'entries' in result);

      expect(result.entries.length).toBeGreaterThan(0);

      for (const entry of result.entries) {
        expect(entry.id).toBeTypeOf('string');
        expect(entry.rendered).toBeUndefined();
      }
    });

    it('returns taxonomy-focused cache tags without timestamps', async () => {
      const loader = wordPressCategoryLoader(createPublicClient());

      const result = await loader.loadEntry({
        collection: 'test',
        filter: { slug: 'technology' },
      });

      assert(result && 'data' in result);

      expect(result.cacheHint?.lastModified).toBeUndefined();
      expect(result.cacheHint?.tags).toContain(
        `wp:entry:categories:${result.data.id}`
      );
      expect(result.cacheHint?.tags).toContain(
        `wp:term:${result.data.taxonomy}:${result.data.id}`
      );
    });
  });

  describe(wordPressMediaLoader, () => {
    it('returns collection entries with string ids when media exists', async () => {
      const loader = wordPressMediaLoader(createPublicClient());

      const result = await loader.loadCollection({
        collection: 'test',
        filter: undefined,
      });

      assert(result && 'entries' in result);

      expect(Array.isArray(result.entries)).toBeTruthy();

      for (const entry of result.entries) {
        expect(entry.id).toBe(String(entry.data.id));
      }
    });

    it('returns one error object for missing media entries', async () => {
      const loader = wordPressMediaLoader(createPublicClient());

      const result = await loader.loadEntry({
        collection: 'test',
        filter: { id: 999_999_999 },
      });

      assert(result && 'error' in result);

      expect(result.error).toBeInstanceOf(Error);
    });

    it('returns media cache hints with lastModified values', async () => {
      const loader = wordPressMediaLoader(createPublicClient());

      const collection = await loader.loadCollection({
        collection: 'test',
        filter: undefined,
      });

      assert(collection && 'entries' in collection);

      if (collection.entries.length === 0) {
        return;
      }

      const result = await loader.loadEntry({
        collection: 'test',
        filter: { id: collection.entries[0].data.id },
      });

      assert(result && 'data' in result);

      expect(result.cacheHint?.lastModified).toBeInstanceOf(Date);
      expect(result.cacheHint?.tags).toContain(
        `wp:entry:media:${result.data.id}`
      );
    });
  });

  describe(wordPressTagLoader, () => {
    it('loads tag entries by slug with non-rendered term payloads', async () => {
      const loader = wordPressTagLoader(createPublicClient());

      const result = await loader.loadEntry({
        collection: 'test',
        filter: { slug: 'featured' },
      });

      assert(result && 'data' in result);

      expect(result.data.slug).toBe('featured');
      expect(result.data.taxonomy).toBe('post_tag');
      expect(result.rendered).toBeUndefined();
    });

    it('returns term cache tags for tag entries', async () => {
      const loader = wordPressTagLoader(createPublicClient());

      const result = await loader.loadEntry({
        collection: 'test',
        filter: { slug: 'featured' },
      });

      assert(result && 'data' in result);

      expect(result.cacheHint?.lastModified).toBeUndefined();
      expect(result.cacheHint?.tags).toContain(
        `wp:term:${result.data.taxonomy}:${result.data.id}`
      );
    });
  });

  describe(wordPressTermLoader, () => {
    it('loads custom taxonomy collection through resource config', async () => {
      const loader = wordPressTermLoader(createPublicClient(), {
        resource: 'genres',
      });

      const result = await loader.loadCollection({
        collection: 'test',
        filter: undefined,
      });

      assert(result && 'entries' in result);

      expect(result.entries.length).toBeGreaterThan(0);
      expect(result.entries[0].data.taxonomy).toBe('genre');
    });

    it('returns custom taxonomy cache tags from the resolved term taxonomy', async () => {
      const loader = wordPressTermLoader(createPublicClient(), {
        resource: 'genres',
      });

      const result = await loader.loadEntry({
        collection: 'test',
        filter: { slug: 'sci-fi' },
      });

      assert(result && 'data' in result);

      expect(result.cacheHint?.tags).toContain(
        `wp:entry:genres:${result.data.id}`
      );
      expect(result.cacheHint?.tags).toContain(
        `wp:term:${result.data.taxonomy}:${result.data.id}`
      );
    });
  });

  describe(wordPressUserLoader, () => {
    it('loads users publicly as Astro live entries with normalized ids', async () => {
      const loader = wordPressUserLoader(createPublicClient());

      const result = await loader.loadCollection({
        collection: 'test',
        filter: undefined,
      });

      assert(result && 'entries' in result);

      expect(result.entries.length).toBeGreaterThan(0);
      expect(result.entries[0].id).toBe(String(result.entries[0].data.id));
      expect(result.entries[0].data.slug).toBeTypeOf('string');

      const publicAllow =
        // SAFETY: The user endpoint supplies self-link capability hints; this test verifies their public visibility.
        (
          result.entries[0].data._links as {
            self?: { targetHints?: { allow?: string[] } }[];
          }
        )?.self?.[0]?.targetHints?.allow ?? [];

      expect(publicAllow).toContain('GET');
      expect(publicAllow).not.toContain('POST');
    });

    it('resolves one user by slug in loadEntry', async () => {
      const loader = wordPressUserLoader(createPublicClient());

      const collection = await loader.loadCollection({
        collection: 'test',
        filter: undefined,
      });

      assert(collection && 'entries' in collection);

      const { slug } = collection.entries[0].data;

      const result = await loader.loadEntry({
        collection: 'test',
        filter: { slug },
      });

      assert(result && 'data' in result);

      expect(result.data.slug).toBe(slug);
    });

    it('loads users with auth and exposes auth-only capability hints', async () => {
      const loader = wordPressUserLoader(createJwtClient());

      const result = await loader.loadEntry({
        collection: 'test',
        filter: { id: 1 },
      });

      assert(result && 'data' in result);

      const authAllow =
        // SAFETY: The user endpoint supplies self-link capability hints; this test verifies authenticated capabilities.
        (
          result.data._links as {
            self?: { targetHints?: { allow?: string[] } }[];
          }
        )?.self?.[0]?.targetHints?.allow ?? [];

      expect(result.data.id).toBe(1);
      expect(authAllow).toContain('GET');
      expect(authAllow).toContain('POST');
    });

    it('returns user cache tags without synthetic timestamps', async () => {
      const loader = wordPressUserLoader(createPublicClient());

      const result = await loader.loadEntry({
        collection: 'test',
        filter: { id: 1 },
      });

      assert(result && 'data' in result);

      expect(result.cacheHint?.lastModified).toBeUndefined();
      expect(result.cacheHint?.tags).toContain('wp:resource:users');
      expect(result.cacheHint?.tags).toContain(`wp:author:${result.data.id}`);
    });
  });

  describe(wordPressContentLoader, () => {
    it('loads custom post type collection through resource config', async () => {
      const loader = wordPressContentLoader(createPublicClient(), {
        resource: 'books',
      });

      const result = await loader.loadCollection({
        collection: 'test',
        filter: undefined,
      });

      assert(result && 'entries' in result);

      expect(result.entries.length).toBeGreaterThan(0);
      expect(result.entries[0].data.type).toBe('book');
      expect(result.entries[0].id).toBe(String(result.entries[0].data.id));
    });

    it('returns rendered html aligned with content.rendered for CPTs', async () => {
      const loader = wordPressContentLoader(createPublicClient(), {
        resource: 'books',
      });

      const result = await loader.loadEntry({
        collection: 'test',
        filter: { slug: 'test-book-001' },
      });

      assert(result && 'data' in result);

      expect(result.data.slug).toBe('test-book-001');
      expect(result.rendered?.html).toBe(result.data.content.rendered);
    });

    it('returns plain data objects suitable for serialization', async () => {
      const loader = wordPressContentLoader(createPublicClient(), {
        resource: 'books',
      });

      const result = await loader.loadCollection({
        collection: 'test',
        filter: undefined,
      });

      assert(result && 'entries' in result);

      expect(result.entries.length).toBeGreaterThan(0);

      for (const entry of result.entries) {
        expectSerializableContentData(entry.data);
      }
    });

    it('forwards search filter for CPT collections', async () => {
      const loader = wordPressContentLoader(createPublicClient(), {
        resource: 'books',
      });

      const result = await loader.loadCollection({
        collection: 'test',
        filter: { search: 'Test Book 001' },
      });

      assert(result && 'entries' in result);

      expect(result.entries.length).toBeGreaterThan(0);
      expect(
        result.entries.some((e) => e.data.slug === 'test-book-001')
      ).toBeTruthy();
      expect(result.cacheHint).toBeUndefined();
      expect(result.entries[0].cacheHint?.tags).toContain(
        `wp:entry:books:${result.entries[0].data.id}`
      );
    });

    it('forwards include filter for CPT collections', async () => {
      const loader = wordPressContentLoader(createPublicClient(), {
        resource: 'books',
      });

      const entry = await loader.loadEntry({
        collection: 'test',
        filter: { slug: 'test-book-001' },
      });

      assert(entry && 'data' in entry);

      const { id } = entry.data;

      const result = await loader.loadCollection({
        collection: 'test',
        filter: { include: [id] },
      });

      assert(result && 'entries' in result);

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].data.id).toBe(id);
    });

    it('forwards exclude filter for CPT collections', async () => {
      const loader = wordPressContentLoader(createPublicClient(), {
        resource: 'books',
      });

      const entry = await loader.loadEntry({
        collection: 'test',
        filter: { slug: 'test-book-001' },
      });

      assert(entry && 'data' in entry);

      const { id } = entry.data;

      const result = await loader.loadCollection({
        collection: 'test',
        filter: { exclude: [id] },
      });

      assert(result && 'entries' in result);

      expect(result.entries.every((e) => e.data.id !== id)).toBeTruthy();
    });

    it('forwards upstream slug collection filter for CPT collections', async () => {
      const loader = wordPressContentLoader(createPublicClient(), {
        resource: 'books',
      });

      const result = await loader.loadCollection({
        collection: 'test',
        filter: { slug: ['test-book-001'] },
      });

      assert(result && 'entries' in result);

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].data.slug).toBe('test-book-001');
    });

    it('returns error object for missing CPT entries', async () => {
      const loader = wordPressContentLoader(createPublicClient(), {
        resource: 'books',
      });

      const result = await loader.loadEntry({
        collection: 'test',
        filter: { slug: 'nonexistent-book-99999' },
      });

      assert(result && 'error' in result);

      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toContain('books entry not found');
    });

    it('supports filtering CPT collection by status with auth', async () => {
      const loader = wordPressContentLoader(createJwtClient(), {
        resource: 'books',
      });

      const result = await loader.loadCollection({
        collection: 'test',
        filter: { status: 'draft' },
      });

      assert(result && 'entries' in result);

      // Should not error with auth
    });

    it('supports opt-in embeds for custom content resources', async () => {
      const loader = wordPressContentLoader(createPublicClient(), {
        embed: true,
        resource: 'books',
      });

      const result = await loader.loadEntry({
        collection: 'test',
        filter: { slug: 'test-book-001' },
      });

      assert(result && 'data' in result);

      expect(result.data._embedded).toBeDefined();
    });

    it('returns cache hints for custom post type entries and collections', async () => {
      const loader = wordPressContentLoader(createPublicClient(), {
        resource: 'books',
      });

      const entryResult = await loader.loadEntry({
        collection: 'test',
        filter: { slug: 'test-book-001' },
      });

      assert(entryResult && 'data' in entryResult);

      const collectionResult = await loader.loadCollection({
        collection: 'test',
        filter: undefined,
      });

      assert(collectionResult && 'entries' in collectionResult);

      expect(entryResult.cacheHint?.lastModified).toBeInstanceOf(Date);
      expect(entryResult.cacheHint?.tags).toContain(
        `wp:entry:books:${entryResult.data.id}`
      );
      expect(entryResult.cacheHint?.tags).toContain(
        `wp:author:${entryResult.data.author}`
      );
      expect(collectionResult.cacheHint?.lastModified).toBeInstanceOf(Date);
      expect(collectionResult.cacheHint?.tags).toContain('wp:resource:books');
    });
  });
});
