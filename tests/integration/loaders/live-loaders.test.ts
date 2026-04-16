import { describe, it, expect, beforeAll } from 'vitest';
import {
  wordPressPostLoader,
  wordPressPageLoader,
  wordPressMediaLoader,
  wordPressCategoryLoader,
  wordPressTagLoader,
  wordPressTermLoader,
  wordPressUserLoader,
  wordPressContentLoader,
} from '../../../src/loaders/live';
import { createJwtAuthHeader, WordPressClient } from 'fluent-wp-client';
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
      const loader = wordPressPostLoader(createPublicClient());
      const result = await loader.loadCollection!({ filter: undefined } as never) as {
        entries: Array<{ id: string; data: Record<string, unknown> }>;
      };

      expect(result.entries.length).toBeGreaterThan(0);

      for (const entry of result.entries) {
        expectSerializableContentData(entry.data);
      }
    });

    it('normalizes nested Astro filter input for loadEntry', async () => {
      const loader = wordPressPostLoader(createPublicClient());
      const result = await loader.loadEntry!({ filter: { filter: { slug: 'test-post-001' } } } as never) as {
        id: string;
        data: { slug: string; content: { rendered: string } };
        rendered?: { html: string };
      };

      expect(result.data.slug).toBe('test-post-001');
      expect(result.rendered?.html).toBe(result.data.content.rendered);
    });

    it('loads embedded relations only when embed is explicitly enabled', async () => {
      const loader = wordPressPostLoader(createPublicClient(), { embed: true });
      const result = await loader.loadEntry!({ filter: { slug: 'test-post-001' } } as never) as {
        data: { _embedded?: unknown };
      };

      expect(result.data._embedded).toBeDefined();
    });

    it('returns one error object for missing entries', async () => {
      const loader = wordPressPostLoader(createPublicClient());
      const result = await loader.loadEntry!({ filter: { slug: 'definitely-no-post' } } as never) as {
        error?: Error;
      };

      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toContain('Post not found');
    });

    it('returns one error object for unauthorized collection access', async () => {
      const loader = wordPressPostLoader(createPublicClient());
      const result = await loader.loadCollection!({ filter: { status: 'draft' } } as never) as {
        error?: Error;
      };

      expect(result.error).toBeInstanceOf(Error);
    });

    it('accepts request-aware auth headers when loading protected content', async () => {
      const loader = wordPressPostLoader(createJwtClient());

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
      const loader = wordPressPageLoader(createPublicClient());
      const result = await loader.loadEntry!({ filter: { slug: 'about' } } as never) as {
        data: { content: { rendered: string } };
        rendered?: { html: string };
      };

      expect(result.rendered?.html).toBe(result.data.content.rendered);
    });

    it('returns plain data objects suitable for serialization', async () => {
      const loader = wordPressPageLoader(createPublicClient());
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
      const loader = wordPressCategoryLoader(createPublicClient());
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

  describe('wordPressMediaLoader', () => {
    it('returns collection entries with string ids when media exists', async () => {
      const loader = wordPressMediaLoader(createPublicClient());
      const result = await loader.loadCollection!({ filter: undefined } as never) as {
        entries: Array<{ id: string; data: { id: number } }>;
      };

      expect(Array.isArray(result.entries)).toBe(true);

      for (const entry of result.entries) {
        expect(entry.id).toBe(String(entry.data.id));
      }
    });

    it('returns one error object for missing media entries', async () => {
      const loader = wordPressMediaLoader(createPublicClient());
      const result = await loader.loadEntry!({ filter: { id: 999999999 } } as never) as {
        error?: Error;
      };

      expect(result.error).toBeInstanceOf(Error);
    });
  });

  describe('wordPressTagLoader', () => {
    it('loads tag entries by slug with non-rendered term payloads', async () => {
      const loader = wordPressTagLoader(createPublicClient());
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
      const loader = wordPressTermLoader(createPublicClient(), {
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
      const loader = wordPressUserLoader(createPublicClient());
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
      const loader = wordPressUserLoader(createPublicClient());
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
      const loader = wordPressUserLoader(createJwtClient());

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

  describe('wordPressContentLoader', () => {
    it('loads custom post type collection through resource config', async () => {
      const loader = wordPressContentLoader(createPublicClient(), {
        resource: 'books',
      });

      const result = await loader.loadCollection!({ filter: undefined } as never) as {
        entries: Array<{ id: string; data: { id: number; type: string; content: { rendered: string } }; rendered?: { html: string } }>;
      };

      expect(result.entries.length).toBeGreaterThan(0);
      expect(result.entries[0].data.type).toBe('book');
      expect(result.entries[0].id).toBe(String(result.entries[0].data.id));
    });

    it('returns rendered html aligned with content.rendered for CPTs', async () => {
      const loader = wordPressContentLoader(createPublicClient(), {
        resource: 'books',
      });

      const result = await loader.loadEntry!({ filter: { slug: 'test-book-001' } } as never) as {
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

      const result = await loader.loadCollection!({ filter: undefined } as never) as {
        entries: Array<{ id: string; data: Record<string, unknown> }>;
      };

      expect(result.entries.length).toBeGreaterThan(0);

      for (const entry of result.entries) {
        expectSerializableContentData(entry.data);
      }
    });

    it('returns error object for missing CPT entries', async () => {
      const loader = wordPressContentLoader(createPublicClient(), {
        resource: 'books',
      });

      const result = await loader.loadEntry!({ filter: { slug: 'nonexistent-book-99999' } } as never) as {
        error?: Error;
      };

      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toContain('books entry not found');
    });

    it('supports filtering CPT collection by status with auth', async () => {
      const loader = wordPressContentLoader(createJwtClient(), {
        resource: 'books',
      });

      const result = await loader.loadCollection!({ filter: { status: 'draft' } } as never) as {
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

      const result = await loader.loadEntry!({ filter: { slug: 'test-book-001' } } as never) as {
        data: { _embedded?: unknown };
      };

      expect(result.data._embedded).toBeDefined();
    });
  });
});
