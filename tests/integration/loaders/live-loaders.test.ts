import { createJwtAuthHeader, WordPressClient } from 'fluent-wp-client';
import { beforeAll, describe, expect, it } from 'vitest';
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
function expectSerializableContentData(data: Record<string, unknown>): void {
  for (const value of Object.values(data)) {
    expect(typeof value).not.toBe('function');
  }

  for (const key of LEGACY_CONTENT_METHOD_KEYS) {
    expect(Object.prototype.hasOwnProperty.call(data, key)).toBe(false);
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
      baseUrl,
      authHeaders: ({ method }) => {
        if (method !== 'GET') {
          throw new Error('Expected GET for live loader auth test.');
        }

        return {
          Authorization: createJwtAuthHeader(process.env.WP_JWT_TOKEN!),
        };
      },
    });
  }

  describe('wordPressPostLoader', () => {
    it('returns Astro live-collection entries with string IDs and rendered html', async () => {
      const loader = wordPressPostLoader(createPublicClient());
      const result = (await loader.loadCollection!({
        filter: undefined,
      } as never)) as {
        entries: Array<{
          id: string;
          data: { id: number; content: { rendered: string } };
          rendered?: { html: string };
        }>;
      };

      expect(Array.isArray(result.entries)).toBe(true);
      expect(result.entries.length).toBeGreaterThan(0);

      const first = result.entries[0];
      expect(typeof first.id).toBe('string');
      expect(first.id).toBe(String(first.data.id));
      expect(first.rendered?.html).toBe(first.data.content.rendered);
    });

    it('returns plain data objects suitable for serialization', async () => {
      const loader = wordPressPostLoader(createPublicClient());
      const result = (await loader.loadCollection!({
        filter: undefined,
      } as never)) as {
        entries: Array<{ id: string; data: Record<string, unknown> }>;
      };

      expect(result.entries.length).toBeGreaterThan(0);

      for (const entry of result.entries) {
        expectSerializableContentData(entry.data);
      }
    });

    it('normalizes nested Astro filter input for loadEntry', async () => {
      const loader = wordPressPostLoader(createPublicClient());
      const result = (await loader.loadEntry!({
        filter: { filter: { slug: 'test-post-001' } },
      } as never)) as {
        id: string;
        data: { slug: string; content: { rendered: string } };
        rendered?: { html: string };
      };

      expect(result.data.slug).toBe('test-post-001');
      expect(result.rendered?.html).toBe(result.data.content.rendered);
    });

    it('loads embedded relations only when embed is explicitly enabled', async () => {
      const loader = wordPressPostLoader(createPublicClient(), { embed: true });
      const result = (await loader.loadEntry!({
        filter: { slug: 'test-post-001' },
      } as never)) as {
        data: { _embedded?: unknown };
      };

      expect(result.data._embedded).toBeDefined();
    });

    it('maps returned entry data with site-specific field labels', async () => {
      const loader = wordPressPostLoader(createPublicClient(), {
        mapEntry: (entry, context) => ({
          ...entry,
          acf: {
            ...(typeof entry.acf === 'object' && entry.acf !== null
              ? entry.acf
              : {}),
            acf_subtitle: `${context.resource}:Mapped label`,
          },
        }),
      });

      const result = (await loader.loadEntry!({
        filter: { slug: 'test-post-001' },
      } as never)) as {
        data: { acf?: { acf_subtitle?: string } };
      };

      expect(result.data.acf?.acf_subtitle).toBe('posts:Mapped label');
    });

    it('supports callback-driven ACF choice labels from live REST API', async () => {
      const choiceLabels = await getAcfChoiceLabels(baseUrl);
      const loader = wordPressPostLoader(createPublicClient(), {
        mapEntry: (entry) => ({
          ...entry,
          acf: {
            ...(typeof entry.acf === 'object' && entry.acf !== null
              ? entry.acf
              : {}),
            acf_project_status:
              choiceLabels
                .get('acf_project_status')
                ?.get(String(entry.acf?.acf_project_status)) ??
              entry.acf?.acf_project_status,
          },
        }),
      });

      const result = (await loader.loadEntry!({
        filter: { slug: 'test-post-001' },
      } as never)) as {
        data: { acf?: { acf_project_status?: string } };
      };

      expect(result.data.acf?.acf_project_status).toBe('In progress');
    });

    it('returns cache hints with lastModified and relationship tags', async () => {
      const loader = wordPressPostLoader(createPublicClient());
      const result = (await loader.loadEntry!({
        filter: { slug: 'test-post-001' },
      } as never)) as {
        data: {
          id: number;
          author: number;
          categories?: number[];
          tags?: number[];
        };
        cacheHint?: { lastModified?: Date; tags?: string[] };
      };

      expect(result.cacheHint?.lastModified).toBeInstanceOf(Date);
      expect(result.cacheHint?.tags).toContain(
        `wp:entry:posts:${result.data.id}`,
      );
      expect(result.cacheHint?.tags).toContain(
        `wp:author:${result.data.author}`,
      );
      expect(result.cacheHint?.tags).toContain(
        `wp:term:category:${result.data.categories?.[0]}`,
      );
      expect(result.cacheHint?.tags).toContain(
        `wp:term:post_tag:${result.data.tags?.[0]}`,
      );
    });

    it('returns collection cache hints with the newest lastModified', async () => {
      const loader = wordPressPostLoader(createPublicClient());
      const result = (await loader.loadCollection!({
        filter: undefined,
      } as never)) as {
        entries: Array<{ data: { modified_gmt: string } }>;
        cacheHint?: { lastModified?: Date; tags?: string[] };
      };

      const expectedLastModified = result.entries
        .map((entry) => new Date(entry.data.modified_gmt))
        .sort((left, right) => right.getTime() - left.getTime())[0];

      expect(result.cacheHint?.lastModified?.toISOString()).toBe(
        expectedLastModified.toISOString(),
      );
      expect(result.cacheHint?.tags).toContain('wp:resource:posts');
    });

    it('forwards pagination filters for listing-style reads', async () => {
      const loader = wordPressPostLoader(createPublicClient());
      const result = (await loader.loadCollection!({
        filter: { orderby: 'slug', order: 'asc', perPage: 20, page: 1 },
      } as never)) as {
        entries: Array<{ data: { slug: string } }>;
      };

      expect(result.entries).toHaveLength(20);
      expect(result.entries[0].data.slug).toBe('test-post-001');
    });

    it('forwards search filter and returns only matching posts', async () => {
      const loader = wordPressPostLoader(createPublicClient());
      const result = (await loader.loadCollection!({
        filter: { search: 'Test Post 001' },
      } as never)) as {
        entries: Array<{
          data: { id: number; slug: string };
          cacheHint?: { tags?: string[] };
        }>;
        cacheHint?: { tags?: string[] };
      };

      expect(result.entries.length).toBeGreaterThan(0);
      expect(result.entries.some((e) => e.data.slug === 'test-post-001')).toBe(
        true,
      );
      expect(result.cacheHint).toBeUndefined();
      expect(result.entries[0].cacheHint?.tags).toContain(
        `wp:entry:posts:${result.entries[0].data.id}`,
      );
    });

    it('forwards include filter and returns only the specified posts', async () => {
      const loader = wordPressPostLoader(createPublicClient());
      // First fetch by slug to get the numeric id
      const entry = (await loader.loadEntry!({
        filter: { slug: 'test-post-001' },
      } as never)) as { data: { id: number } };

      const id = entry.data.id;

      const result = (await loader.loadCollection!({
        filter: { include: [id] },
      } as never)) as {
        entries: Array<{ data: { id: number } }>;
      };

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].data.id).toBe(id);
    });

    it('forwards exclude filter and omits the specified post', async () => {
      const loader = wordPressPostLoader(createPublicClient());
      const entry = (await loader.loadEntry!({
        filter: { slug: 'test-post-001' },
      } as never)) as { data: { id: number } };

      const id = entry.data.id;

      const result = (await loader.loadCollection!({
        filter: { perPage: 20, exclude: [id] },
      } as never)) as {
        entries: Array<{ data: { id: number } }>;
      };

      expect(result.entries.every((e) => e.data.id !== id)).toBe(true);
    });

    it('forwards upstream slug collection filter without treating it as lookup-only', async () => {
      const loader = wordPressPostLoader(createPublicClient());
      const result = (await loader.loadCollection!({
        filter: { slug: ['test-post-001'] },
      } as never)) as {
        entries: Array<{ data: { slug: string } }>;
      };

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].data.slug).toBe('test-post-001');
    });

    it('returns one error object for missing entries', async () => {
      const loader = wordPressPostLoader(createPublicClient());
      const result = (await loader.loadEntry!({
        filter: { slug: 'definitely-no-post' },
      } as never)) as {
        error?: Error;
      };

      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toContain('Post not found');
    });

    it('returns one error object for unauthorized collection access', async () => {
      const loader = wordPressPostLoader(createPublicClient());
      const result = (await loader.loadCollection!({
        filter: { status: 'draft' },
      } as never)) as {
        error?: Error;
      };

      expect(result.error).toBeInstanceOf(Error);
    });

    it('accepts request-aware auth headers when loading protected content', async () => {
      const loader = wordPressPostLoader(createJwtClient());

      const result = (await loader.loadCollection!({
        filter: { status: 'draft' },
      } as never)) as {
        entries?: unknown[];
        error?: Error;
      };

      expect(result.error).toBeUndefined();
      expect(Array.isArray(result.entries)).toBe(true);
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
        }),
      );

      const result = (await loader.loadEntry!({
        filter: { slug: 'test-post-001' },
      } as never)) as {
        data?: { slug: string };
        error?: Error;
      };

      expect(result.error).toBeUndefined();
      expect(result.data?.slug).toBe('test-post-001');
      expect(requestCount).toBeGreaterThan(0);
    });
  });

  describe('wordPressPageLoader', () => {
    it('includes rendered html for page entries', async () => {
      const loader = wordPressPageLoader(createPublicClient());
      const result = (await loader.loadEntry!({
        filter: { slug: 'about' },
      } as never)) as {
        data: { content: { rendered: string } };
        rendered?: { html: string };
      };

      expect(result.rendered?.html).toBe(result.data.content.rendered);
    });

    it('returns plain data objects suitable for serialization', async () => {
      const loader = wordPressPageLoader(createPublicClient());
      const result = (await loader.loadCollection!({
        filter: undefined,
      } as never)) as {
        entries: Array<{ id: string; data: Record<string, unknown> }>;
      };

      expect(result.entries.length).toBeGreaterThan(0);

      for (const entry of result.entries) {
        expectSerializableContentData(entry.data);
      }
    });

    it('returns cache hints with page timestamps and author tags', async () => {
      const loader = wordPressPageLoader(createPublicClient());
      const result = (await loader.loadEntry!({
        filter: { slug: 'about' },
      } as never)) as {
        data: { id: number; author: number };
        cacheHint?: { lastModified?: Date; tags?: string[] };
      };

      expect(result.cacheHint?.lastModified).toBeInstanceOf(Date);
      expect(result.cacheHint?.tags).toContain(
        `wp:entry:pages:${result.data.id}`,
      );
      expect(result.cacheHint?.tags).toContain(
        `wp:author:${result.data.author}`,
      );
    });
  });

  describe('wordPressCategoryLoader', () => {
    it('returns taxonomy entries without rendered html blocks', async () => {
      const loader = wordPressCategoryLoader(createPublicClient());
      const result = (await loader.loadCollection!({
        filter: undefined,
      } as never)) as {
        entries: Array<{ id: string; rendered?: { html: string } }>;
      };

      expect(result.entries.length).toBeGreaterThan(0);
      for (const entry of result.entries) {
        expect(typeof entry.id).toBe('string');
        expect(entry.rendered).toBeUndefined();
      }
    });

    it('returns taxonomy-focused cache tags without timestamps', async () => {
      const loader = wordPressCategoryLoader(createPublicClient());
      const result = (await loader.loadEntry!({
        filter: { slug: 'technology' },
      } as never)) as {
        data: { id: number; taxonomy: string };
        cacheHint?: { lastModified?: Date; tags?: string[] };
      };

      expect(result.cacheHint?.lastModified).toBeUndefined();
      expect(result.cacheHint?.tags).toContain(
        `wp:entry:categories:${result.data.id}`,
      );
      expect(result.cacheHint?.tags).toContain(
        `wp:term:${result.data.taxonomy}:${result.data.id}`,
      );
    });
  });

  describe('wordPressMediaLoader', () => {
    it('returns collection entries with string ids when media exists', async () => {
      const loader = wordPressMediaLoader(createPublicClient());
      const result = (await loader.loadCollection!({
        filter: undefined,
      } as never)) as {
        entries: Array<{ id: string; data: { id: number } }>;
      };

      expect(Array.isArray(result.entries)).toBe(true);

      for (const entry of result.entries) {
        expect(entry.id).toBe(String(entry.data.id));
      }
    });

    it('returns one error object for missing media entries', async () => {
      const loader = wordPressMediaLoader(createPublicClient());
      const result = (await loader.loadEntry!({
        filter: { id: 999999999 },
      } as never)) as {
        error?: Error;
      };

      expect(result.error).toBeInstanceOf(Error);
    });

    it('returns media cache hints with lastModified values', async () => {
      const loader = wordPressMediaLoader(createPublicClient());
      const collection = (await loader.loadCollection!({
        filter: undefined,
      } as never)) as {
        entries: Array<{ id: string; data: { id: number } }>;
      };

      if (collection.entries.length === 0) {
        return;
      }

      const result = (await loader.loadEntry!({
        filter: { id: collection.entries[0].data.id },
      } as never)) as {
        data: { id: number };
        cacheHint?: { lastModified?: Date; tags?: string[] };
      };

      expect(result.cacheHint?.lastModified).toBeInstanceOf(Date);
      expect(result.cacheHint?.tags).toContain(
        `wp:entry:media:${result.data.id}`,
      );
    });
  });

  describe('wordPressTagLoader', () => {
    it('loads tag entries by slug with non-rendered term payloads', async () => {
      const loader = wordPressTagLoader(createPublicClient());
      const result = (await loader.loadEntry!({
        filter: { slug: 'featured' },
      } as never)) as {
        id: string;
        data: { slug: string; taxonomy: string };
        rendered?: { html: string };
      };

      expect(result.data.slug).toBe('featured');
      expect(result.data.taxonomy).toBe('post_tag');
      expect(result.rendered).toBeUndefined();
    });

    it('returns term cache tags for tag entries', async () => {
      const loader = wordPressTagLoader(createPublicClient());
      const result = (await loader.loadEntry!({
        filter: { slug: 'featured' },
      } as never)) as {
        data: { id: number; taxonomy: string };
        cacheHint?: { tags?: string[]; lastModified?: Date };
      };

      expect(result.cacheHint?.lastModified).toBeUndefined();
      expect(result.cacheHint?.tags).toContain(
        `wp:term:${result.data.taxonomy}:${result.data.id}`,
      );
    });
  });

  describe('wordPressTermLoader', () => {
    it('loads custom taxonomy collection through resource config', async () => {
      const loader = wordPressTermLoader(createPublicClient(), {
        resource: 'genres',
      });

      const result = (await loader.loadCollection!({
        filter: undefined,
      } as never)) as {
        entries: Array<{ id: string; data: { taxonomy: string } }>;
      };

      expect(result.entries.length).toBeGreaterThan(0);
      expect(result.entries[0].data.taxonomy).toBe('genre');
    });

    it('returns custom taxonomy cache tags from the resolved term taxonomy', async () => {
      const loader = wordPressTermLoader(createPublicClient(), {
        resource: 'genres',
      });

      const result = (await loader.loadEntry!({
        filter: { slug: 'sci-fi' },
      } as never)) as {
        data: { id: number; taxonomy: string };
        cacheHint?: { tags?: string[] };
      };

      expect(result.cacheHint?.tags).toContain(
        `wp:entry:genres:${result.data.id}`,
      );
      expect(result.cacheHint?.tags).toContain(
        `wp:term:${result.data.taxonomy}:${result.data.id}`,
      );
    });
  });

  describe('wordPressUserLoader', () => {
    it('loads users publicly as Astro live entries with normalized ids', async () => {
      const loader = wordPressUserLoader(createPublicClient());
      const result = (await loader.loadCollection!({
        filter: undefined,
      } as never)) as {
        entries: Array<{
          id: string;
          data: { id: number; slug: string; _links?: unknown };
        }>;
      };

      expect(result.entries.length).toBeGreaterThan(0);
      expect(result.entries[0].id).toBe(String(result.entries[0].data.id));
      expect(typeof result.entries[0].data.slug).toBe('string');

      const publicAllow =
        (
          result.entries[0].data._links as {
            self?: Array<{ targetHints?: { allow?: string[] } }>;
          }
        )?.self?.[0]?.targetHints?.allow ?? [];

      expect(publicAllow).toContain('GET');
      expect(publicAllow).not.toContain('POST');
    });

    it('resolves one user by slug in loadEntry', async () => {
      const loader = wordPressUserLoader(createPublicClient());
      const collection = (await loader.loadCollection!({
        filter: undefined,
      } as never)) as {
        entries: Array<{ data: { slug: string } }>;
      };

      const slug = collection.entries[0].data.slug;
      const result = (await loader.loadEntry!({
        filter: { slug },
      } as never)) as {
        data: { slug: string };
      };

      expect(result.data.slug).toBe(slug);
    });

    it('loads users with auth and exposes auth-only capability hints', async () => {
      const loader = wordPressUserLoader(createJwtClient());

      const result = (await loader.loadEntry!({
        filter: { id: 1 },
      } as never)) as {
        data: { id: number; _links?: unknown };
      };

      const authAllow =
        (
          result.data._links as {
            self?: Array<{ targetHints?: { allow?: string[] } }>;
          }
        )?.self?.[0]?.targetHints?.allow ?? [];

      expect(result.data.id).toBe(1);
      expect(authAllow).toContain('GET');
      expect(authAllow).toContain('POST');
    });

    it('returns user cache tags without synthetic timestamps', async () => {
      const loader = wordPressUserLoader(createPublicClient());
      const result = (await loader.loadEntry!({
        filter: { id: 1 },
      } as never)) as {
        data: { id: number };
        cacheHint?: { lastModified?: Date; tags?: string[] };
      };

      expect(result.cacheHint?.lastModified).toBeUndefined();
      expect(result.cacheHint?.tags).toContain('wp:resource:users');
      expect(result.cacheHint?.tags).toContain(`wp:author:${result.data.id}`);
    });
  });

  describe('wordPressContentLoader', () => {
    it('loads custom post type collection through resource config', async () => {
      const loader = wordPressContentLoader(createPublicClient(), {
        resource: 'books',
      });

      const result = (await loader.loadCollection!({
        filter: undefined,
      } as never)) as {
        entries: Array<{
          id: string;
          data: { id: number; type: string; content: { rendered: string } };
          rendered?: { html: string };
        }>;
      };

      expect(result.entries.length).toBeGreaterThan(0);
      expect(result.entries[0].data.type).toBe('book');
      expect(result.entries[0].id).toBe(String(result.entries[0].data.id));
    });

    it('returns rendered html aligned with content.rendered for CPTs', async () => {
      const loader = wordPressContentLoader(createPublicClient(), {
        resource: 'books',
      });

      const result = (await loader.loadEntry!({
        filter: { slug: 'test-book-001' },
      } as never)) as {
        data: { slug: string; content: { rendered: string } };
        rendered?: { html: string };
      };

      expect(result.data.slug).toBe('test-book-001');
      expect(result.rendered?.html).toBe(result.data.content.rendered);
    });

    it('returns plain data objects suitable for serialization', async () => {
      const loader = wordPressContentLoader(createPublicClient(), {
        resource: 'books',
      });

      const result = (await loader.loadCollection!({
        filter: undefined,
      } as never)) as {
        entries: Array<{ id: string; data: Record<string, unknown> }>;
      };

      expect(result.entries.length).toBeGreaterThan(0);

      for (const entry of result.entries) {
        expectSerializableContentData(entry.data);
      }
    });

    it('forwards search filter for CPT collections', async () => {
      const loader = wordPressContentLoader(createPublicClient(), {
        resource: 'books',
      });

      const result = (await loader.loadCollection!({
        filter: { search: 'Test Book 001' },
      } as never)) as {
        entries: Array<{
          data: { id: number; slug: string };
          cacheHint?: { tags?: string[] };
        }>;
        cacheHint?: { tags?: string[] };
      };

      expect(result.entries.length).toBeGreaterThan(0);
      expect(result.entries.some((e) => e.data.slug === 'test-book-001')).toBe(
        true,
      );
      expect(result.cacheHint).toBeUndefined();
      expect(result.entries[0].cacheHint?.tags).toContain(
        `wp:entry:books:${result.entries[0].data.id}`,
      );
    });

    it('forwards include filter for CPT collections', async () => {
      const loader = wordPressContentLoader(createPublicClient(), {
        resource: 'books',
      });

      const entry = (await loader.loadEntry!({
        filter: { slug: 'test-book-001' },
      } as never)) as { data: { id: number } };

      const id = entry.data.id;

      const result = (await loader.loadCollection!({
        filter: { include: [id] },
      } as never)) as {
        entries: Array<{ data: { id: number } }>;
      };

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].data.id).toBe(id);
    });

    it('forwards exclude filter for CPT collections', async () => {
      const loader = wordPressContentLoader(createPublicClient(), {
        resource: 'books',
      });

      const entry = (await loader.loadEntry!({
        filter: { slug: 'test-book-001' },
      } as never)) as { data: { id: number } };

      const id = entry.data.id;

      const result = (await loader.loadCollection!({
        filter: { exclude: [id] },
      } as never)) as {
        entries: Array<{ data: { id: number } }>;
      };

      expect(result.entries.every((e) => e.data.id !== id)).toBe(true);
    });

    it('forwards upstream slug collection filter for CPT collections', async () => {
      const loader = wordPressContentLoader(createPublicClient(), {
        resource: 'books',
      });

      const result = (await loader.loadCollection!({
        filter: { slug: ['test-book-001'] },
      } as never)) as {
        entries: Array<{ data: { slug: string } }>;
      };

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].data.slug).toBe('test-book-001');
    });

    it('returns error object for missing CPT entries', async () => {
      const loader = wordPressContentLoader(createPublicClient(), {
        resource: 'books',
      });

      const result = (await loader.loadEntry!({
        filter: { slug: 'nonexistent-book-99999' },
      } as never)) as {
        error?: Error;
      };

      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toContain('books entry not found');
    });

    it('supports filtering CPT collection by status with auth', async () => {
      const loader = wordPressContentLoader(createJwtClient(), {
        resource: 'books',
      });

      const result = (await loader.loadCollection!({
        filter: { status: 'draft' },
      } as never)) as {
        entries?: unknown[];
        error?: Error;
      };

      // Should not error with auth
      expect(result.error).toBeUndefined();
    });

    it('supports opt-in embeds for custom content resources', async () => {
      const loader = wordPressContentLoader(createPublicClient(), {
        resource: 'books',
        embed: true,
      });

      const result = (await loader.loadEntry!({
        filter: { slug: 'test-book-001' },
      } as never)) as {
        data: { _embedded?: unknown };
      };

      expect(result.data._embedded).toBeDefined();
    });

    it('returns cache hints for custom post type entries and collections', async () => {
      const loader = wordPressContentLoader(createPublicClient(), {
        resource: 'books',
      });

      const entryResult = (await loader.loadEntry!({
        filter: { slug: 'test-book-001' },
      } as never)) as {
        data: { id: number; author: number };
        cacheHint?: { lastModified?: Date; tags?: string[] };
      };
      const collectionResult = (await loader.loadCollection!({
        filter: undefined,
      } as never)) as {
        cacheHint?: { lastModified?: Date; tags?: string[] };
      };

      expect(entryResult.cacheHint?.lastModified).toBeInstanceOf(Date);
      expect(entryResult.cacheHint?.tags).toContain(
        `wp:entry:books:${entryResult.data.id}`,
      );
      expect(entryResult.cacheHint?.tags).toContain(
        `wp:author:${entryResult.data.author}`,
      );
      expect(collectionResult.cacheHint?.lastModified).toBeInstanceOf(Date);
      expect(collectionResult.cacheHint?.tags).toContain('wp:resource:books');
    });
  });
});
