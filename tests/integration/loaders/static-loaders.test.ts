import { describe, it, expect, beforeAll } from 'vitest';
import {
  wordPressPostStaticLoader,
  wordPressPageStaticLoader,
  wordPressCategoryStaticLoader,
  wordPressTagStaticLoader,
  wordPressTermStaticLoader,
  wordPressUserStaticLoader,
  wordPressContentStaticLoader,
} from '../../../src/loaders/static';
import { createMockStore } from '../../helpers/mock-store';
import { createMockLogger } from '../../helpers/mock-logger';
import { getBaseUrl } from '../../helpers/wp-client';

/**
 * Legacy helper method keys from fluent-wp-client v1 content wrappers.
 */
const LEGACY_CONTENT_METHOD_KEYS = ['get', 'getContent', 'getBlocks', 'then'] as const;

/**
 * Asserts one loader record data object is plain and serialization-safe.
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

    /**
     * Serialization test: static loaders must return plain serializable data
     * without function properties. This ensures compatibility with Astro's
     * devalue-based content store serialization (issue #19).
     */
    it('stores plain serializable data without function properties', async () => {
      const loader = wordPressPostStaticLoader({ baseUrl });
      const { store, entries } = createMockStore();
      const logger = createMockLogger();

      await loader.load({ store, logger } as never);

      expect(entries.size).toBeGreaterThan(0);
      for (const entry of entries.values()) {
        expectSerializableContentData(entry.data as Record<string, unknown>);
      }
    });
  });

  describe('wordPressPageStaticLoader', () => {
    /**
     * Serialization test: pages must also be plain serializable data.
     */
    it('stores plain serializable data without function properties', async () => {
      const loader = wordPressPageStaticLoader({ baseUrl });
      const { store, entries } = createMockStore();
      const logger = createMockLogger();

      await loader.load({ store, logger } as never);

      expect(entries.size).toBeGreaterThan(0);
      for (const entry of entries.values()) {
        expectSerializableContentData(entry.data as Record<string, unknown>);
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

  describe('wordPressContentStaticLoader', () => {
    it('stores CPT entries with string ids and rendered html', async () => {
      const loader = wordPressContentStaticLoader({
        baseUrl,
        resource: 'books',
      });
      const { store, entries } = createMockStore();
      const logger = createMockLogger();

      await loader.load({ store, logger } as never);

      expect(entries.size).toBeGreaterThan(0);
      const first = entries.values().next().value as {
        data: { type: string; content: { rendered: string } };
        rendered?: { html: string };
      };
      expect(first.data.type).toBe('book');
      expect(first.rendered?.html).toBe(first.data.content.rendered);
    });

    it('stores plain serializable data without function properties', async () => {
      const loader = wordPressContentStaticLoader({
        baseUrl,
        resource: 'books',
      });
      const { store, entries } = createMockStore();
      const logger = createMockLogger();

      await loader.load({ store, logger } as never);

      expect(entries.size).toBeGreaterThan(0);
      for (const entry of entries.values()) {
        expectSerializableContentData(entry.data as Record<string, unknown>);
      }
    });

    it('clears store before loading CPT entries', async () => {
      const loader = wordPressContentStaticLoader({
        baseUrl,
        resource: 'books',
      });
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

    it('logs successful CPT loader completion', async () => {
      const loader = wordPressContentStaticLoader({
        baseUrl,
        resource: 'books',
      });
      const { store, entries } = createMockStore();
      const logger = createMockLogger();

      await loader.load({ store, logger } as never);

      expect(entries.size).toBeGreaterThan(0);
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Loaded'));
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('books'));
    });
  });
});
