import { describe, it, expect, beforeAll } from 'vitest';
import {
  wordPressPostLoader,
  wordPressPageLoader,
  wordPressMediaLoader,
  wordPressCategoryLoader,
} from '../../../src/loaders/live';
import { getBaseUrl } from '../../helpers/wp-client';

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

    it('loadEntry by slug returns a post with rendered HTML', async () => {
      const loader = wordPressPostLoader({ baseUrl });

      // Grab a slug from the collection first
      const collResult = await loader.loadCollection!({ filter: undefined } as any);
      const slug = (collResult as any).entries[0].data.slug;

      const result = await loader.loadEntry!({ filter: { slug } } as any);

      expect('id' in result).toBe(true);
      expect((result as any).rendered.html).toBeTruthy();
    });

    it('loadEntry by id returns a post with rendered HTML', async () => {
      const loader = wordPressPostLoader({ baseUrl });

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

    it('loadEntry by slug returns a page with rendered HTML', async () => {
      const loader = wordPressPageLoader({ baseUrl });

      const collResult = await loader.loadCollection!({ filter: undefined } as any);
      const slug = (collResult as any).entries[0].data.slug;

      const result = await loader.loadEntry!({ filter: { slug } } as any);

      expect('id' in result).toBe(true);
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

    it('loadEntry by slug returns a category', async () => {
      const loader = wordPressCategoryLoader({ baseUrl });
      const result = await loader.loadEntry!({ filter: { slug: 'test-category' } } as any);

      expect('id' in result).toBe(true);
      expect((result as any).data.slug).toBe('test-category');
    });

    it('loadEntry by id returns a category', async () => {
      const seededCatIds = (process.env.WP_SEEDED_CATEGORY_IDS || '').split(',').map(Number);
      const loader = wordPressCategoryLoader({ baseUrl });
      const result = await loader.loadEntry!({ filter: { id: seededCatIds[0] } } as any);

      expect('id' in result).toBe(true);
      expect((result as any).data.id).toBe(seededCatIds[0]);
    });

    it('loadEntry returns error for non-existent category', async () => {
      const loader = wordPressCategoryLoader({ baseUrl });
      const result = await loader.loadEntry!({ filter: { slug: 'no-cat-999' } } as any);

      expect('error' in result).toBe(true);
    });
  });
});
