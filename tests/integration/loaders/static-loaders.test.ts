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
import { WordPressClient } from 'fluent-wp-client';
import { createMockStore } from '../../helpers/mock-store';
import { createMockLogger } from '../../helpers/mock-logger';
import { getBaseUrl } from '../../helpers/wp-client';
import { getAcfChoiceLabels, useAcfChoiceCatalog } from '../../helpers/acf-choice-catalog';

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

  /**
   * Creates one public WordPress client for static loader tests.
   */
  function createClient(): WordPressClient {
    return new WordPressClient({ baseUrl });
  }

  describe('wordPressPostStaticLoader', () => {
    it('clears the Astro store and then writes normalized entries', async () => {
      const loader = wordPressPostStaticLoader(createClient());
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
      const loader = wordPressPostStaticLoader(createClient());
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
      const loader = wordPressPostStaticLoader(createClient());
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
      const loader = wordPressPostStaticLoader(createClient());
      const { store, entries } = createMockStore();
      const logger = createMockLogger();

      await loader.load({ store, logger } as never);

      expect(entries.size).toBeGreaterThan(0);
      for (const entry of entries.values()) {
        expectSerializableContentData(entry.data as Record<string, unknown>);
      }
    });

    it('maps stored entry data with site-specific field labels', async () => {
      const loader = wordPressPostStaticLoader(createClient(), {
        mapEntry: (entry, context) => ({
          ...entry,
          acf: {
            ...(typeof entry.acf === 'object' && entry.acf !== null ? entry.acf : {}),
            acf_subtitle: `${context.resource}:Mapped label`,
          },
        }),
      });
      const { store, entries } = createMockStore();
      const logger = createMockLogger();

      await loader.load({ store, logger } as never);

      const mapped = [...entries.values()].find((entry) => {
        const data = entry.data as { slug?: string };
        return data.slug === 'test-post-001';
      }) as { data: { acf?: { acf_subtitle?: string } } } | undefined;

      expect(mapped?.data.acf?.acf_subtitle).toBe('posts:Mapped label');
    });

    it('supports callback-driven ACF choice labels from discovery metadata', async () => {
      const client = useAcfChoiceCatalog(createClient());
      const choiceLabels = await getAcfChoiceLabels(client);
      const loader = wordPressPostStaticLoader(client, {
        mapEntry: (entry) => ({
          ...entry,
          acf: {
            ...(typeof entry.acf === 'object' && entry.acf !== null ? entry.acf : {}),
            acf_project_status: choiceLabels
              .get('acf_project_status')
              ?.get(String(entry.acf?.acf_project_status)) ?? entry.acf?.acf_project_status,
          },
        }),
      });
      const { store, entries } = createMockStore();
      const logger = createMockLogger();

      await loader.load({ store, logger } as never);

      const mapped = [...entries.values()].find((entry) => {
        const data = entry.data as { slug?: string };
        return data.slug === 'test-post-001';
      }) as { data: { acf?: { acf_project_status?: string } } } | undefined;

      expect(mapped?.data.acf?.acf_project_status).toBe('In progress');
    });
  });

  describe('wordPressPageStaticLoader', () => {
    /**
     * Serialization test: pages must also be plain serializable data.
     */
    it('stores plain serializable data without function properties', async () => {
      const loader = wordPressPageStaticLoader(createClient());
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
      const loader = wordPressCategoryStaticLoader(createClient());
      const { store, entries } = createMockStore();
      const logger = createMockLogger();

      await loader.load({ store, logger } as never);

      expect(entries.size).toBeGreaterThan(0);
      for (const entry of entries.values()) {
        expect(entry.rendered).toBeUndefined();
      }
    });

    it('logs successful tag loader completion', async () => {
      const loader = wordPressTagStaticLoader(createClient());
      const { store, entries } = createMockStore();
      const logger = createMockLogger();

      await loader.load({ store, logger } as never);

      expect(entries.size).toBeGreaterThan(0);
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Loaded'));
    });

    it('loads custom taxonomy static entries by resource', async () => {
      const loader = wordPressTermStaticLoader(createClient(), {
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
      const loader = wordPressUserStaticLoader(createClient());
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

    it('does not expose private user fields (e.g. email) through public client static loading', async () => {
      const loader = wordPressUserStaticLoader(createClient());
      const { store, entries } = createMockStore();
      const logger = createMockLogger();

      await loader.load({ store, logger } as never);

      expect(entries.size).toBeGreaterThan(0);
      for (const entry of entries.values()) {
        const data = entry.data as Record<string, unknown>;
        // WordPress REST API hides email from unauthenticated requests
        expect(data.email).toBeUndefined();
      }
    });
  });

  describe('wordPressContentStaticLoader', () => {
    it('stores CPT entries with string ids and rendered html', async () => {
      const loader = wordPressContentStaticLoader(createClient(), {
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
      const loader = wordPressContentStaticLoader(createClient(), {
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
      const loader = wordPressContentStaticLoader(createClient(), {
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
      const loader = wordPressContentStaticLoader(createClient(), {
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
