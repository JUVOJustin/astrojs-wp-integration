import { describe, it, expect, beforeAll } from 'vitest';
import {
  wordPressContentStaticLoader,
  wordPressPostStaticLoader,
  wordPressCategoryStaticLoader,
  wordPressTagStaticLoader,
  wordPressTermStaticLoader,
  wordPressUserStaticLoader,
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

    it('loads parsed Gutenberg blocks when block mode is enabled with auth', async () => {
      const password = process.env.WP_APP_PASSWORD;

      if (!password) {
        throw new Error('WP_APP_PASSWORD not set — did global-setup run?');
      }

      const loader = wordPressPostStaticLoader({
        baseUrl,
        auth: {
          username: 'admin',
          password,
        },
        blocks: true,
      });

      const { store, entries } = createMockStore();
      const logger = createMockLogger();

      await loader.load({ store, logger } as never);

      const match = [...entries.values()].find((entry) => {
        const data = entry.data as { slug?: string };
        return data.slug === 'test-post-001';
      }) as {
        data: { blocks?: Array<{ blockName: string | null }> };
      } | undefined;

      expect(match).toBeDefined();
      expect(Array.isArray(match?.data.blocks)).toBe(true);
      expect(match?.data.blocks?.some((block) => block.blockName === 'core/heading')).toBe(true);
      expect(match?.data.blocks?.some((block) => block.blockName === 'core/paragraph')).toBe(true);
      expect(match?.data.blocks?.some((block) => block.blockName === 'core/image')).toBe(true);
    });

    it('throws one auth error when block mode is enabled without credentials', async () => {
      const loader = wordPressPostStaticLoader({
        baseUrl,
        blocks: true,
      });

      const { store } = createMockStore();
      const logger = createMockLogger();

      await expect(loader.load({ store, logger } as never)).rejects.toThrow(/requires authentication/i);
    });
  });

  describe('wordPressContentStaticLoader', () => {
    it('loads custom post type entries and parsed blocks by REST resource', async () => {
      const password = process.env.WP_APP_PASSWORD;

      if (!password) {
        throw new Error('WP_APP_PASSWORD not set — did global-setup run?');
      }

      const loader = wordPressContentStaticLoader({
        baseUrl,
        resource: 'books',
        auth: {
          username: 'admin',
          password,
        },
        blocks: true,
      });

      const { store, entries } = createMockStore();
      const logger = createMockLogger();

      await loader.load({ store, logger } as never);

      const first = entries.values().next().value as {
        data: { type: string; blocks?: Array<{ blockName: string | null }> };
      };

      expect(entries.size).toBeGreaterThan(0);
      expect(first.data.type).toBe('book');
      expect(first.data.blocks?.some((block) => block.blockName === 'core/paragraph')).toBe(true);
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

  describe('wordPressUserStaticLoader', () => {
    it('stores user entries using string ids and no rendered html', async () => {
      const loader = wordPressUserStaticLoader({ baseUrl });
      const { store, entries } = createMockStore();
      const logger = createMockLogger();

      await loader.load({ store, logger } as never);

      expect(entries.size).toBeGreaterThan(0);
      for (const [key, entry] of entries) {
        expect(typeof key).toBe('string');
        expect(Number.isFinite(Number(key))).toBe(true);
        expect(entry.rendered).toBeUndefined();
      }
    });
  });
});
