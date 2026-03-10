import { describe, it, expect, beforeAll } from 'vitest';
import {
  wordPressPostStaticLoader,
  wordPressCategoryStaticLoader,
  wordPressTagStaticLoader,
  wordPressTermStaticLoader,
} from '../../../src/loaders/static';
import { createMockStore } from '../../helpers/mock-store';
import { createMockLogger } from '../../helpers/mock-logger';
import { getBaseUrl } from '../../helpers/wp-client';

/**
 * Astro static-loader integration focused on build-time store behavior.
 *
 * This suite validates Astro-facing semantics: clear-before-load, entry key
 * normalization, rendered-html mapping, and non-rendered taxonomy behavior.
 */
describe('Static Loaders', () => {
  let baseUrl: string;

  beforeAll(() => {
    baseUrl = getBaseUrl();
  });

  describe('wordPressPostStaticLoader', () => {
    it('clears the Astro store and then writes normalized entries', async () => {
      const loader = wordPressPostStaticLoader({ baseUrl });
      const { store, entries } = createMockStore();
      const logger = createMockLogger();

      entries.set('999', {
        data: { id: 999 },
      });

      await loader.load({ store, logger } as never);

      expect(store.clear).toHaveBeenCalledTimes(1);
      expect(entries.has('999')).toBe(false);
      expect(entries.size).toBeGreaterThan(0);
    });

    it('stores rendered html aligned with post.content.rendered', async () => {
      const loader = wordPressPostStaticLoader({ baseUrl });
      const { store, entries } = createMockStore();
      const logger = createMockLogger();

      await loader.load({ store, logger } as never);

      const first = entries.values().next().value as {
        data: { content: { rendered: string } };
        rendered?: { html: string };
      };

      expect(first.rendered?.html).toBe(first.data.content.rendered);
    });

    it('uses stringified numeric ids as datastore keys', async () => {
      const loader = wordPressPostStaticLoader({ baseUrl });
      const { store, entries } = createMockStore();
      const logger = createMockLogger();

      await loader.load({ store, logger } as never);

      for (const key of entries.keys()) {
        expect(typeof key).toBe('string');
        expect(Number.isFinite(Number(key))).toBe(true);
      }
    });
  });

  describe('taxonomy static loaders', () => {
    it('does not attach rendered html for categories', async () => {
      const loader = wordPressCategoryStaticLoader({ baseUrl });
      const { store, entries } = createMockStore();
      const logger = createMockLogger();

      await loader.load({ store, logger } as never);

      expect(entries.size).toBeGreaterThan(0);
      for (const entry of entries.values()) {
        expect(entry.rendered).toBeUndefined();
      }
    });

    it('logs successful tag loader completion', async () => {
      const loader = wordPressTagStaticLoader({ baseUrl });
      const { store, entries } = createMockStore();
      const logger = createMockLogger();

      await loader.load({ store, logger } as never);

      expect(entries.size).toBeGreaterThan(0);
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Loaded'));
    });

    it('loads custom taxonomy static entries by resource', async () => {
      const loader = wordPressTermStaticLoader({
        baseUrl,
        resource: 'genres',
      });
      const { store, entries } = createMockStore();
      const logger = createMockLogger();

      await loader.load({ store, logger } as never);

      expect(entries.size).toBeGreaterThan(0);
      const first = entries.values().next().value as {
        data: { taxonomy: string };
      };
      expect(first.data.taxonomy).toBe('genre');
    });
  });
});
