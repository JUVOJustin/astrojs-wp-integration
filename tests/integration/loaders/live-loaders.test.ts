import { describe, it, expect, beforeAll } from 'vitest';
import {
  wordPressPostLoader,
  wordPressPageLoader,
  wordPressCategoryLoader,
  wordPressTagLoader,
  wordPressTermLoader,
  wordPressUserLoader,
} from '../../../src/loaders/live';
import { createJwtAuthHeader } from 'fluent-wp-client';
import { getBaseUrl } from '../../helpers/wp-client';

/**
 * Legacy helper method keys from fluent-wp-client v1 content wrappers.
 */
const LEGACY_CONTENT_METHOD_KEYS = ['get', 'getContent', 'getBlocks', 'then'] as const;

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

  describe('wordPressPostLoader', () => {
    it('returns Astro live-collection entries with string IDs and rendered html', async () => {
      const loader = wordPressPostLoader({ baseUrl });
      const result = await loader.loadCollection!({ filter: undefined } as never) as {
        entries: Array<{ id: string; data: { id: number; content: { rendered: string } }; rendered?: { html: string } }>;
      };

      expect(Array.isArray(result.entries)).toBe(true);
      expect(result.entries.length).toBeGreaterThan(0);

      const first = result.entries[0];
      expect(typeof first.id).toBe('string');
      expect(first.id).toBe(String(first.data.id));
      expect(first.rendered?.html).toBe(first.data.content.rendered);
    });

    it('returns plain data objects suitable for serialization', async () => {
      const loader = wordPressPostLoader({ baseUrl });
      const result = await loader.loadCollection!({ filter: undefined } as never) as {
        entries: Array<{ id: string; data: Record<string, unknown> }>;
      };

      expect(result.entries.length).toBeGreaterThan(0);

      for (const entry of result.entries) {
        expectSerializableContentData(entry.data);
      }
    });

    it('normalizes nested Astro filter input for loadEntry', async () => {
      const loader = wordPressPostLoader({ baseUrl });
      const result = await loader.loadEntry!({ filter: { filter: { slug: 'test-post-001' } } } as never) as {
        id: string;
        data: { slug: string; content: { rendered: string }; _embedded?: unknown };
        rendered?: { html: string };
      };

      expect(result.data.slug).toBe('test-post-001');
      expect(result.rendered?.html).toBe(result.data.content.rendered);
      expect(result.data._embedded).toBeDefined();
    });

    it('returns one error object for missing entries', async () => {
      const loader = wordPressPostLoader({ baseUrl });
      const result = await loader.loadEntry!({ filter: { slug: 'definitely-no-post' } } as never) as {
        error?: Error;
      };

      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toContain('Post not found');
    });

    it('returns one error object for unauthorized collection access', async () => {
      const loader = wordPressPostLoader({ baseUrl });
      const result = await loader.loadCollection!({ filter: { status: 'draft' } } as never) as {
        error?: Error;
      };

      expect(result.error).toBeInstanceOf(Error);
    });

    it('accepts request-aware auth headers when loading protected content', async () => {
      const loader = wordPressPostLoader({
        baseUrl,
        authHeaders: ({ method, url }) => {
          if (method !== 'GET') {
            throw new Error('Expected GET for live loader auth test.');
          }

          if (!url.pathname.endsWith('/wp-json/wp/v2/posts')) {
            throw new Error('Expected posts endpoint for live loader auth test.');
          }

          return {
            Authorization: createJwtAuthHeader(process.env.WP_JWT_TOKEN!),
          };
        },
      });

      const result = await loader.loadCollection!({ filter: { status: 'draft' } } as never) as {
        entries?: unknown[];
        error?: Error;
      };

      expect(result.error).toBeUndefined();
      expect(Array.isArray(result.entries)).toBe(true);
    });
  });

  describe('wordPressPageLoader', () => {
    it('includes rendered html for page entries', async () => {
      const loader = wordPressPageLoader({ baseUrl });
      const result = await loader.loadEntry!({ filter: { slug: 'about' } } as never) as {
        data: { content: { rendered: string } };
        rendered?: { html: string };
      };

      expect(result.rendered?.html).toBe(result.data.content.rendered);
    });

    it('returns plain data objects suitable for serialization', async () => {
      const loader = wordPressPageLoader({ baseUrl });
      const result = await loader.loadCollection!({ filter: undefined } as never) as {
        entries: Array<{ id: string; data: Record<string, unknown> }>;
      };

      expect(result.entries.length).toBeGreaterThan(0);

      for (const entry of result.entries) {
        expectSerializableContentData(entry.data);
      }
    });
  });

  describe('wordPressCategoryLoader', () => {
    it('returns taxonomy entries without rendered html blocks', async () => {
      const loader = wordPressCategoryLoader({ baseUrl });
      const result = await loader.loadCollection!({ filter: undefined } as never) as {
        entries: Array<{ id: string; rendered?: { html: string } }>;
      };

      expect(result.entries.length).toBeGreaterThan(0);
      for (const entry of result.entries) {
        expect(typeof entry.id).toBe('string');
        expect(entry.rendered).toBeUndefined();
      }
    });
  });

  describe('wordPressTagLoader', () => {
    it('loads tag entries by slug with non-rendered term payloads', async () => {
      const loader = wordPressTagLoader({ baseUrl });
      const result = await loader.loadEntry!({ filter: { slug: 'featured' } } as never) as {
        id: string;
        data: { slug: string; taxonomy: string };
        rendered?: { html: string };
      };

      expect(result.data.slug).toBe('featured');
      expect(result.data.taxonomy).toBe('post_tag');
      expect(result.rendered).toBeUndefined();
    });
  });

  describe('wordPressTermLoader', () => {
    it('loads custom taxonomy collection through resource config', async () => {
      const loader = wordPressTermLoader({
        baseUrl,
        resource: 'genres',
      });

      const result = await loader.loadCollection!({ filter: undefined } as never) as {
        entries: Array<{ id: string; data: { taxonomy: string } }>;
      };

      expect(result.entries.length).toBeGreaterThan(0);
      expect(result.entries[0].data.taxonomy).toBe('genre');
    });
  });

  describe('wordPressUserLoader', () => {
    it('loads users publicly as Astro live entries with normalized ids', async () => {
      const loader = wordPressUserLoader({ baseUrl });
      const result = await loader.loadCollection!({ filter: undefined } as never) as {
        entries: Array<{ id: string; data: { id: number; slug: string; _links?: unknown } }>;
      };

      expect(result.entries.length).toBeGreaterThan(0);
      expect(result.entries[0].id).toBe(String(result.entries[0].data.id));
      expect(typeof result.entries[0].data.slug).toBe('string');

      const publicAllow = ((result.entries[0].data._links as {
        self?: Array<{ targetHints?: { allow?: string[] } }>;
      })?.self?.[0]?.targetHints?.allow) ?? [];

      expect(publicAllow).toContain('GET');
      expect(publicAllow).not.toContain('POST');
    });

    it('resolves one user by slug in loadEntry', async () => {
      const loader = wordPressUserLoader({ baseUrl });
      const collection = await loader.loadCollection!({ filter: undefined } as never) as {
        entries: Array<{ data: { slug: string } }>;
      };

      const slug = collection.entries[0].data.slug;
      const result = await loader.loadEntry!({ filter: { slug } } as never) as {
        data: { slug: string };
      };

      expect(result.data.slug).toBe(slug);
    });

    it('loads users with auth and exposes auth-only capability hints', async () => {
      const loader = wordPressUserLoader({
        baseUrl,
        authHeaders: () => ({
          Authorization: createJwtAuthHeader(process.env.WP_JWT_TOKEN!),
        }),
      });

      const result = await loader.loadEntry!({ filter: { id: 1 } } as never) as {
        data: { id: number; _links?: unknown };
      };

      const authAllow = ((result.data._links as {
        self?: Array<{ targetHints?: { allow?: string[] } }>;
      })?.self?.[0]?.targetHints?.allow) ?? [];

      expect(result.data.id).toBe(1);
      expect(authAllow).toContain('GET');
      expect(authAllow).toContain('POST');
    });
  });
});
