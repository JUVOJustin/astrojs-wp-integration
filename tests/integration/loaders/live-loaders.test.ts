import { describe, it, expect, beforeAll } from 'vitest';
import {
  wordPressPostLoader,
  wordPressPageLoader,
  wordPressMediaLoader,
  wordPressCategoryLoader,
} from '../../../src/loaders/live';
import { createJwtAuthHeader } from '../../../src/client/auth';
import { getBaseUrl } from '../../helpers/wp-client';

/**
 * Live loaders return data directly from the WP REST API at runtime.
 * Assertions use known slugs and counts from the deterministic seed data.
 */
describe('Live Loaders', () => {
  let baseUrl: string;

  beforeAll(() => {
    baseUrl = getBaseUrl();
  });

  describe('wordPressPostLoader', () => {
    it('loadCollection returns entries', async () => {
      const loader = wordPressPostLoader({ baseUrl });
      const result = (await loader.loadCollection!({ filter: undefined } as any)) as any;

      expect('entries' in result).toBe(true);
      const { entries } = result as { entries: any[] };
      expect(entries.length).toBeGreaterThan(0);
    });

    it('each collection entry has id and data', async () => {
      const loader = wordPressPostLoader({ baseUrl });
      const result = (await loader.loadCollection!({ filter: undefined } as any)) as any;
      const { entries } = result as { entries: any[] };

      for (const entry of entries) {
        expect(entry).toHaveProperty('id');
        expect(entry).toHaveProperty('data');
        expect(typeof entry.id).toBe('string');
      }
    });

    it('loadEntry by slug returns a known seed post with rendered HTML and native meta', async () => {
      const loader = wordPressPostLoader({ baseUrl });
      const result = (await loader.loadEntry!({ filter: { slug: 'test-post-001' } } as any)) as any;

      expect('id' in result).toBe(true);
      expect((result as any).data.slug).toBe('test-post-001');
      expect((result as any).rendered.html).toBeTruthy();
      expect((result as any).data.meta).toEqual(expect.objectContaining({
        test_string_meta: 'Seed string meta for test-post-001',
        test_number_meta: 11.5,
        test_array_meta: ['seed-post-001-a', 'seed-post-001-b'],
      }));
    });

    it('loadEntry by id returns the correct post', async () => {
      const loader = wordPressPostLoader({ baseUrl });

      // Get a post ID from the collection first
      const collResult = (await loader.loadCollection!({ filter: undefined } as any)) as any;
      const id = (collResult as any).entries[0].data.id;

      const result = (await loader.loadEntry!({ filter: { id } } as any)) as any;

      expect('id' in result).toBe(true);
      expect((result as any).data.id).toBe(id);
    });

    it('loadEntry returns error for non-existent slug', async () => {
      const loader = wordPressPostLoader({ baseUrl });
      const result = (await loader.loadEntry!({ filter: { slug: 'does-not-exist-999' } } as any)) as any;

      expect('error' in result).toBe(true);
    });

    it('returns auth error when querying draft posts without auth', async () => {
      const loader = wordPressPostLoader({ baseUrl });
      const result = (await loader.loadCollection!({ filter: { status: 'draft' } } as any)) as any;

      expect('error' in result).toBe(true);
    });

    it('supports basic auth when querying draft posts', async () => {
      const loader = wordPressPostLoader({
        baseUrl,
        auth: {
          username: 'admin',
          password: process.env.WP_APP_PASSWORD!,
        },
      });
      const result = (await loader.loadCollection!({ filter: { status: 'draft' } } as any)) as any;

      expect('entries' in result).toBe(true);
      expect(Array.isArray((result as any).entries)).toBe(true);
    });

    it('supports JWT auth header when querying draft posts', async () => {
      const loader = wordPressPostLoader({
        baseUrl,
        authHeader: createJwtAuthHeader(process.env.WP_JWT_TOKEN!),
      });
      const result = (await loader.loadCollection!({ filter: { status: 'draft' } } as any)) as any;

      expect('entries' in result).toBe(true);
      expect(Array.isArray((result as any).entries)).toBe(true);
    });

    it('supports JWT token auth object when querying draft posts', async () => {
      const loader = wordPressPostLoader({
        baseUrl,
        auth: {
          token: process.env.WP_JWT_TOKEN!,
        },
      });
      const result = (await loader.loadCollection!({ filter: { status: 'draft' } } as any)) as any;

      expect('entries' in result).toBe(true);
      expect(Array.isArray((result as any).entries)).toBe(true);
    });

    it('supports request-aware auth headers when querying draft posts', async () => {
      const loader = wordPressPostLoader({
        baseUrl,
        authHeaders: ({ method, url }) => {
          if (method !== 'GET') {
            throw new Error('Expected GET for live loader auth provider test.');
          }

          if (!url.pathname.endsWith('/wp-json/wp/v2/posts')) {
            throw new Error('Expected posts endpoint for live loader auth provider test.');
          }

          return {
            Authorization: createJwtAuthHeader(process.env.WP_JWT_TOKEN!),
          };
        },
      });
      const result = (await loader.loadCollection!({ filter: { status: 'draft' } } as any)) as any;

      expect('entries' in result).toBe(true);
      expect(Array.isArray((result as any).entries)).toBe(true);
    });
  });

  describe('wordPressPageLoader', () => {
    it('loadCollection returns entries', async () => {
      const loader = wordPressPageLoader({ baseUrl });
      const result = (await loader.loadCollection!({ filter: undefined } as any)) as any;

      expect('entries' in result).toBe(true);
      const { entries } = result as { entries: any[] };
      expect(entries.length).toBeGreaterThan(0);
    });

    it('loadEntry by slug returns a known seed page with rendered HTML and native meta', async () => {
      const loader = wordPressPageLoader({ baseUrl });
      const result = (await loader.loadEntry!({ filter: { slug: 'about' } } as any)) as any;

      expect('id' in result).toBe(true);
      expect((result as any).data.slug).toBe('about');
      expect((result as any).rendered.html).toBeTruthy();
      expect((result as any).data.meta).toEqual(expect.objectContaining({
        test_string_meta: 'Seed string meta for about-page',
        test_number_meta: 21.5,
        test_array_meta: ['seed-about-a', 'seed-about-b'],
      }));
    });

    it('loadEntry returns error for non-existent page', async () => {
      const loader = wordPressPageLoader({ baseUrl });
      const result = (await loader.loadEntry!({ filter: { slug: 'no-such-page-999' } } as any)) as any;

      expect('error' in result).toBe(true);
    });
  });

  describe('wordPressMediaLoader', () => {
    it('loadCollection returns entries array', async () => {
      const loader = wordPressMediaLoader({ baseUrl });
      const result = (await loader.loadCollection!({ filter: undefined } as any)) as any;

      expect('entries' in result).toBe(true);
      expect(Array.isArray((result as any).entries)).toBe(true);
    });

    it('loadEntry returns error for non-existent media', async () => {
      const loader = wordPressMediaLoader({ baseUrl });
      const result = (await loader.loadEntry!({ filter: { slug: 'no-media-999' } } as any)) as any;

      expect('error' in result).toBe(true);
    });
  });

  describe('wordPressCategoryLoader', () => {
    it('loadCollection returns entries', async () => {
      const loader = wordPressCategoryLoader({ baseUrl });
      const result = (await loader.loadCollection!({ filter: undefined } as any)) as any;

      expect('entries' in result).toBe(true);
      const { entries } = result as { entries: any[] };
      expect(entries.length).toBeGreaterThan(0);
    });

    it('loadEntry by slug returns a known seed category', async () => {
      const loader = wordPressCategoryLoader({ baseUrl });
      const result = (await loader.loadEntry!({ filter: { slug: 'technology' } } as any)) as any;

      expect('id' in result).toBe(true);
      expect((result as any).data.slug).toBe('technology');
    });

    it('loadEntry by id returns a category', async () => {
      const loader = wordPressCategoryLoader({ baseUrl });

      // Get a category ID from the collection first
      const collResult = (await loader.loadCollection!({ filter: undefined } as any)) as any;
      const id = (collResult as any).entries[0].data.id;

      const result = (await loader.loadEntry!({ filter: { id } } as any)) as any;

      expect('id' in result).toBe(true);
      expect((result as any).data.id).toBe(id);
    });

    it('loadEntry returns error for non-existent category', async () => {
      const loader = wordPressCategoryLoader({ baseUrl });
      const result = (await loader.loadEntry!({ filter: { slug: 'no-cat-999' } } as any)) as any;

      expect('error' in result).toBe(true);
    });
  });
});
