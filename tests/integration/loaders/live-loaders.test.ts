import { describe, it, expect, beforeAll } from 'vitest';
import {
  wordPressPostLoader,
  wordPressPageLoader,
  wordPressMediaLoader,
  wordPressCategoryLoader,
} from '../../../src/loaders/live';
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
      const result = await loader.loadCollection!({ filter: undefined } as any);

      expect('entries' in result).toBe(true);
      const { entries } = result as { entries: any[] };
      expect(entries.length).toBeGreaterThan(0);
    });

    it('each collection entry has id and data', async () => {
      const loader = wordPressPostLoader({ baseUrl });
      const result = await loader.loadCollection!({ filter: undefined } as any);
      const { entries } = result as { entries: any[] };

      for (const entry of entries) {
        expect(entry).toHaveProperty('id');
        expect(entry).toHaveProperty('data');
        expect(typeof entry.id).toBe('string');
      }
    });

    it('loadEntry by slug returns a known seed post with rendered HTML', async () => {
      const loader = wordPressPostLoader({ baseUrl });
      const result = await loader.loadEntry!({ filter: { slug: 'test-post-001' } } as any);

      expect('id' in result).toBe(true);
      expect((result as any).data.slug).toBe('test-post-001');
      expect((result as any).rendered.html).toBeTruthy();
    });

    it('loadEntry by id returns the correct post', async () => {
      const loader = wordPressPostLoader({ baseUrl });

      // Get a post ID from the collection first
      const collResult = await loader.loadCollection!({ filter: undefined } as any);
      const id = (collResult as any).entries[0].data.id;

      const result = await loader.loadEntry!({ filter: { id } } as any);

      expect('id' in result).toBe(true);
      expect((result as any).data.id).toBe(id);
    });

    it('loadEntry returns error for non-existent slug', async () => {
      const loader = wordPressPostLoader({ baseUrl });
      const result = await loader.loadEntry!({ filter: { slug: 'does-not-exist-999' } } as any);

      expect('error' in result).toBe(true);
    });
  });

  describe('wordPressPageLoader', () => {
    it('loadCollection returns entries', async () => {
      const loader = wordPressPageLoader({ baseUrl });
      const result = await loader.loadCollection!({ filter: undefined } as any);

      expect('entries' in result).toBe(true);
      const { entries } = result as { entries: any[] };
      expect(entries.length).toBeGreaterThan(0);
    });

    it('loadEntry by slug returns a known seed page with rendered HTML', async () => {
      const loader = wordPressPageLoader({ baseUrl });
      const result = await loader.loadEntry!({ filter: { slug: 'about' } } as any);

      expect('id' in result).toBe(true);
      expect((result as any).data.slug).toBe('about');
      expect((result as any).rendered.html).toBeTruthy();
    });

    it('loadEntry returns error for non-existent page', async () => {
      const loader = wordPressPageLoader({ baseUrl });
      const result = await loader.loadEntry!({ filter: { slug: 'no-such-page-999' } } as any);

      expect('error' in result).toBe(true);
    });
  });

  describe('wordPressMediaLoader', () => {
    it('loadCollection returns entries array', async () => {
      const loader = wordPressMediaLoader({ baseUrl });
      const result = await loader.loadCollection!({ filter: undefined } as any);

      expect('entries' in result).toBe(true);
      expect(Array.isArray((result as any).entries)).toBe(true);
    });

    it('loadEntry returns error for non-existent media', async () => {
      const loader = wordPressMediaLoader({ baseUrl });
      const result = await loader.loadEntry!({ filter: { slug: 'no-media-999' } } as any);

      expect('error' in result).toBe(true);
    });
  });

  describe('wordPressCategoryLoader', () => {
    it('loadCollection returns entries', async () => {
      const loader = wordPressCategoryLoader({ baseUrl });
      const result = await loader.loadCollection!({ filter: undefined } as any);

      expect('entries' in result).toBe(true);
      const { entries } = result as { entries: any[] };
      expect(entries.length).toBeGreaterThan(0);
    });

    it('loadEntry by slug returns a known seed category', async () => {
      const loader = wordPressCategoryLoader({ baseUrl });
      const result = await loader.loadEntry!({ filter: { slug: 'technology' } } as any);

      expect('id' in result).toBe(true);
      expect((result as any).data.slug).toBe('technology');
    });

    it('loadEntry by id returns a category', async () => {
      const loader = wordPressCategoryLoader({ baseUrl });

      // Get a category ID from the collection first
      const collResult = await loader.loadCollection!({ filter: undefined } as any);
      const id = (collResult as any).entries[0].data.id;

      const result = await loader.loadEntry!({ filter: { id } } as any);

      expect('id' in result).toBe(true);
      expect((result as any).data.id).toBe(id);
    });

    it('loadEntry returns error for non-existent category', async () => {
      const loader = wordPressCategoryLoader({ baseUrl });
      const result = await loader.loadEntry!({ filter: { slug: 'no-cat-999' } } as any);

      expect('error' in result).toBe(true);
    });
  });
});
