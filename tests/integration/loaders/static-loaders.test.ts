import { describe, it, expect, beforeAll } from 'vitest';
import { wordPressPostStaticLoader } from '../../../src/loaders/static';
import { wordPressPageStaticLoader } from '../../../src/loaders/static';
import { wordPressCategoryStaticLoader } from '../../../src/loaders/static';
import { wordPressTagStaticLoader } from '../../../src/loaders/static';
import { createMockStore } from '../../helpers/mock-store';
import { createMockLogger } from '../../helpers/mock-logger';
import { getBaseUrl } from '../../helpers/wp-client';

/**
 * Static loaders fetch all content at build time and write to a mock Astro DataStore.
 * Assertions use exact counts from the deterministic seed data.
 */
describe('Static Loaders', () => {
  let baseUrl: string;

  beforeAll(() => {
    baseUrl = getBaseUrl();
  });

  describe('wordPressPostStaticLoader', () => {
    it('populates the store with all 150 posts', async () => {
      const loader = wordPressPostStaticLoader({ baseUrl });
      const { store, entries } = createMockStore();
      const logger = createMockLogger();

      await loader.load({ store, logger } as any);

      expect(entries.size).toBe(150);
      expect(store.clear).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Loaded'));
    });

    it('stores rendered HTML for each post', async () => {
      const loader = wordPressPostStaticLoader({ baseUrl });
      const { store, entries } = createMockStore();
      const logger = createMockLogger();

      await loader.load({ store, logger } as any);

      for (const [, entry] of entries) {
        expect(entry.rendered).toBeDefined();
        expect(entry.rendered!.html).toBeTruthy();
      }
    });

    it('uses string IDs as store keys', async () => {
      const loader = wordPressPostStaticLoader({ baseUrl });
      const { store, entries } = createMockStore();
      const logger = createMockLogger();

      await loader.load({ store, logger } as any);

      for (const key of entries.keys()) {
        expect(typeof key).toBe('string');
        expect(Number(key)).not.toBeNaN();
      }
    });
  });

  describe('wordPressPageStaticLoader', () => {
    it('populates the store with all 10 pages', async () => {
      const loader = wordPressPageStaticLoader({ baseUrl });
      const { store, entries } = createMockStore();
      const logger = createMockLogger();

      await loader.load({ store, logger } as any);

      expect(entries.size).toBe(10);
      expect(store.clear).toHaveBeenCalled();
    });

    it('stores rendered HTML for each page', async () => {
      const loader = wordPressPageStaticLoader({ baseUrl });
      const { store, entries } = createMockStore();
      const logger = createMockLogger();

      await loader.load({ store, logger } as any);

      for (const [, entry] of entries) {
        expect(entry.rendered).toBeDefined();
        expect(entry.rendered!.html).toBeTruthy();
      }
    });
  });

  describe('wordPressCategoryStaticLoader', () => {
    it('populates the store with all 6 categories', async () => {
      const loader = wordPressCategoryStaticLoader({ baseUrl });
      const { store, entries } = createMockStore();
      const logger = createMockLogger();

      await loader.load({ store, logger } as any);

      expect(entries.size).toBe(6);
      expect(store.clear).toHaveBeenCalled();
    });

    it('does not store rendered HTML for categories', async () => {
      const loader = wordPressCategoryStaticLoader({ baseUrl });
      const { store, entries } = createMockStore();
      const logger = createMockLogger();

      await loader.load({ store, logger } as any);

      for (const [, entry] of entries) {
        expect(entry.rendered).toBeUndefined();
      }
    });
  });

  describe('wordPressTagStaticLoader', () => {
    it('populates the store with all 8 tags', async () => {
      const loader = wordPressTagStaticLoader({ baseUrl });
      const { store, entries } = createMockStore();
      const logger = createMockLogger();

      await loader.load({ store, logger } as any);

      expect(entries.size).toBe(8);
      expect(store.clear).toHaveBeenCalled();
    });
  });
});
