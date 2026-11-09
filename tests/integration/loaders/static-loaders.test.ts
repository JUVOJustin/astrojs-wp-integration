import type { Loader } from 'astro/loaders';
import { WordPressClient } from 'fluent-wp-client';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  wordPressCategoryStaticLoader,
  wordPressContentStaticLoader,
  wordPressPageStaticLoader,
  wordPressPostStaticLoader,
  wordPressTagStaticLoader,
  wordPressTermStaticLoader,
  wordPressUserStaticLoader,
} from '../../../src/loaders/static';
import { getAcfChoiceLabels } from '../../helpers/acf-choice-catalog';
import { createMockLogger } from '../../helpers/mock-logger';
import { createMockStore } from '../../helpers/mock-store';
import { getBaseUrl } from '../../helpers/wp-client';

// These loaders consume only the store and logger; real Astro builds cover the full context.
function loadWithStore(
  loader: Loader,
  context: {
    logger: ReturnType<typeof createMockLogger>;
    store: ReturnType<typeof createMockStore>['store'];
  }
) {
  // SAFETY: The omitted Astro services are not read by our static loaders.
  return loader.load(context as never);
}

/**
 * Legacy helper method keys from fluent-wp-client v1 content wrappers.
 */
const LEGACY_CONTENT_METHOD_KEYS = [
  'get',
  'getContent',
  'getBlocks',
  'then',
] as const;

/**
 * Asserts one loader record data object is plain and serialization-safe.
 */
// oxlint-disable-next-line anti-slop/no-unsafe-dictionary-type -- The serialization assertion must inspect every field of a WordPress record.
function expectSerializableContentData(data: Record<string, unknown>): void {
  for (const value of Object.values(data)) {
    expect(value).not.toBeTypeOf('function');
  }

  for (const key of LEGACY_CONTENT_METHOD_KEYS) {
    expect(Object.hasOwn(data, key)).toBeFalsy();
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

  describe(wordPressPostStaticLoader, () => {
    it('clears the Astro store and then writes normalized entries', async () => {
      const loader = wordPressPostStaticLoader(createClient());
      const { store, entries } = createMockStore();
      const logger = createMockLogger();

      entries.set('999', {
        data: { id: 999 },
      });

      await loadWithStore(loader, { logger, store });

      expect(store.clear).toHaveBeenCalledOnce();
      expect(entries.has('999')).toBeFalsy();
      expect(entries.size).toBeGreaterThan(0);
    });

    it('stores rendered html aligned with post.content.rendered', async () => {
      const loader = wordPressPostStaticLoader(createClient());
      const { store, entries } = createMockStore();
      const logger = createMockLogger();

      await loadWithStore(loader, { logger, store });

      // SAFETY: The fixture store erases resource types; this scenario checks the expected rendered content fields.
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

      await loadWithStore(loader, { logger, store });

      for (const key of entries.keys()) {
        expect(key).toBeTypeOf('string');
        expect(Number.isFinite(Number(key))).toBeTruthy();
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

      await loadWithStore(loader, { logger, store });

      expect(entries.size).toBeGreaterThan(0);

      for (const entry of entries.values()) {
        // SAFETY: Static content is stored as a plain record; the assertion rejects methods on its values.
        // oxlint-disable-next-line anti-slop/no-unsafe-dictionary-type -- The serialization assertion must inspect every field of a WordPress record.
        expectSerializableContentData(entry.data as Record<string, unknown>);
      }
    });

    it('maps stored entry data with site-specific field labels', async () => {
      const loader = wordPressPostStaticLoader(createClient(), {
        mapEntry: (entry, context) => ({
          ...entry,
          acf: {
            // oxlint-disable-next-line anti-slop/no-runtime-typeof -- ACF may return an empty array; preserve existing fields only when an object is available.
            ...(typeof entry.acf === 'object' && entry.acf !== null
              ? entry.acf
              : undefined),
            acf_subtitle: `${context.resource}:Mapped label`,
          },
        }),
      });

      const { store, entries } = createMockStore();
      const logger = createMockLogger();

      await loadWithStore(loader, { logger, store });

      // SAFETY: This scenario maps ACF fields on test-post-001 and checks the projected value below.
      const mapped = [...entries.values()].find((entry) => {
        // SAFETY: The selected content loader supplies post slugs; use that field to locate the seeded fixture.
        const data = entry.data as { slug?: string };

        return data.slug === 'test-post-001';
      }) as { data: { acf?: { acf_subtitle?: string } } } | undefined;

      expect(mapped?.data.acf?.acf_subtitle).toBe('posts:Mapped label');
    });

    it('supports callback-driven ACF choice labels from live REST API', async () => {
      const choiceLabels = await getAcfChoiceLabels(baseUrl);

      const loader = wordPressPostStaticLoader(createClient(), {
        mapEntry: (entry) => ({
          ...entry,
          acf: {
            // oxlint-disable-next-line anti-slop/no-runtime-typeof -- ACF may return an empty array; preserve existing fields only when an object is available.
            ...(typeof entry.acf === 'object' && entry.acf !== null
              ? entry.acf
              : undefined),
            acf_project_status:
              choiceLabels
                .get('acf_project_status')
                ?.get(
                  String(
                    Array.isArray(entry.acf)
                      ? undefined
                      : entry.acf?.acf_project_status
                  )
                ) ??
              (Array.isArray(entry.acf)
                ? undefined
                : entry.acf?.acf_project_status),
          },
        }),
      });

      const { store, entries } = createMockStore();
      const logger = createMockLogger();

      await loadWithStore(loader, { logger, store });

      // SAFETY: This scenario maps ACF fields on test-post-001 and checks the projected value below.
      const mapped = [...entries.values()].find((entry) => {
        // SAFETY: The selected content loader supplies post slugs; use that field to locate the seeded fixture.
        const data = entry.data as { slug?: string };

        return data.slug === 'test-post-001';
      }) as { data: { acf?: { acf_project_status?: string } } } | undefined;

      expect(mapped?.data.acf?.acf_project_status).toBe('In progress');
    });
  });

  describe(wordPressPageStaticLoader, () => {
    /**
     * Serialization test: pages must also be plain serializable data.
     */
    it('stores plain serializable data without function properties', async () => {
      const loader = wordPressPageStaticLoader(createClient());
      const { store, entries } = createMockStore();
      const logger = createMockLogger();

      await loadWithStore(loader, { logger, store });

      expect(entries.size).toBeGreaterThan(0);

      for (const entry of entries.values()) {
        // SAFETY: Static content is stored as a plain record; the assertion rejects methods on its values.
        // oxlint-disable-next-line anti-slop/no-unsafe-dictionary-type -- The serialization assertion must inspect every field of a WordPress record.
        expectSerializableContentData(entry.data as Record<string, unknown>);
      }
    });
  });

  describe('taxonomy static loaders', () => {
    it('does not attach rendered html for categories', async () => {
      const loader = wordPressCategoryStaticLoader(createClient());
      const { store, entries } = createMockStore();
      const logger = createMockLogger();

      await loadWithStore(loader, { logger, store });

      expect(entries.size).toBeGreaterThan(0);

      for (const entry of entries.values()) {
        expect(entry.rendered).toBeUndefined();
      }
    });

    it('logs successful tag loader completion', async () => {
      const loader = wordPressTagStaticLoader(createClient());
      const { store, entries } = createMockStore();
      const logger = createMockLogger();

      await loadWithStore(loader, { logger, store });

      expect(entries.size).toBeGreaterThan(0);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Loaded')
      );
    });

    it('loads custom taxonomy static entries by resource', async () => {
      const loader = wordPressTermStaticLoader(createClient(), {
        resource: 'genres',
      });

      const { store, entries } = createMockStore();
      const logger = createMockLogger();

      await loadWithStore(loader, { logger, store });

      expect(entries.size).toBeGreaterThan(0);

      // SAFETY: The fixture store erases resource types; this scenario checks the expected rendered content fields.
      const first = entries.values().next().value as {
        data: { taxonomy: string };
      };

      expect(first.data.taxonomy).toBe('genre');
    });
  });

  describe(wordPressUserStaticLoader, () => {
    it('stores user entries using string ids and no rendered html', async () => {
      const loader = wordPressUserStaticLoader(createClient());
      const { store, entries } = createMockStore();
      const logger = createMockLogger();

      await loadWithStore(loader, { logger, store });

      expect(entries.size).toBeGreaterThan(0);

      for (const [key, entry] of entries) {
        expect(key).toBeTypeOf('string');
        expect(Number.isFinite(Number(key))).toBeTruthy();
        expect(entry.rendered).toBeUndefined();
      }
    });

    it('does not expose private user fields (e.g. email) through public client static loading', async () => {
      const loader = wordPressUserStaticLoader(createClient());
      const { store, entries } = createMockStore();
      const logger = createMockLogger();

      await loadWithStore(loader, { logger, store });

      expect(entries.size).toBeGreaterThan(0);

      for (const entry of entries.values()) {
        // SAFETY: The public user loader stores a REST object; the assertions check which fields are exposed.
        // oxlint-disable-next-line anti-slop/no-unsafe-dictionary-type -- User REST fields vary by authentication; this assertion checks their visibility.
        const data = entry.data as Record<string, unknown>;
        // WordPress REST API hides email from unauthenticated requests
        expect(data.email).toBeUndefined();
      }
    });
  });

  describe(wordPressContentStaticLoader, () => {
    it('stores CPT entries with string ids and rendered html', async () => {
      const loader = wordPressContentStaticLoader(createClient(), {
        resource: 'books',
      });

      const { store, entries } = createMockStore();
      const logger = createMockLogger();

      await loadWithStore(loader, { logger, store });

      expect(entries.size).toBeGreaterThan(0);

      // SAFETY: The fixture store erases resource types; this scenario checks the expected rendered content fields.
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

      await loadWithStore(loader, { logger, store });

      expect(entries.size).toBeGreaterThan(0);

      for (const entry of entries.values()) {
        // SAFETY: Static content is stored as a plain record; the assertion rejects methods on its values.
        // oxlint-disable-next-line anti-slop/no-unsafe-dictionary-type -- The serialization assertion must inspect every field of a WordPress record.
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

      await loadWithStore(loader, { logger, store });

      expect(store.clear).toHaveBeenCalledOnce();
      expect(entries.has('999')).toBeFalsy();
      expect(entries.size).toBeGreaterThan(0);
    });

    it('logs successful CPT loader completion', async () => {
      const loader = wordPressContentStaticLoader(createClient(), {
        resource: 'books',
      });

      const { store, entries } = createMockStore();
      const logger = createMockLogger();

      await loadWithStore(loader, { logger, store });

      expect(entries.size).toBeGreaterThan(0);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Loaded')
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('books')
      );
    });

    it('scopes CPT collection at build time with include filter', async () => {
      // First load without filter to get a known id
      const loaderAll = wordPressContentStaticLoader(createClient(), {
        resource: 'books',
      });

      const { store: storeAll, entries: entriesAll } = createMockStore();
      await loadWithStore(loaderAll, {
        logger: createMockLogger(),
        store: storeAll,
      });

      const firstId =
        // SAFETY: The posts loader supplies numeric IDs; the next request exercises filtering with this returned ID.
        (entriesAll.values().next().value as { data: { id: number } }).data.id;

      const loader = wordPressContentStaticLoader(createClient(), {
        filter: { include: [firstId] },
        resource: 'books',
      });

      const { store, entries } = createMockStore();
      const logger = createMockLogger();

      await loadWithStore(loader, { logger, store });

      expect(entries.size).toBe(1);
      expect(
        // SAFETY: The filtered posts loader must return the requested ID or slug, checked by this assertion.
        (entries.values().next().value as { data: { id: number } }).data.id
      ).toBe(firstId);
    });
  });

  describe('build-time filters', () => {
    it('scopes post collection at build time with search filter', async () => {
      const loader = wordPressPostStaticLoader(createClient(), {
        filter: { search: 'Test Post 001' },
      });

      const { store, entries } = createMockStore();

      await loadWithStore(loader, { logger: createMockLogger(), store });

      expect(entries.size).toBeGreaterThan(0);

      const slugs = [...entries.values()].map(
        // SAFETY: This posts fixture expects slugs; the following assertion checks the actual returned values.
        (e) => (e as { data: { slug: string } }).data.slug
      );

      expect(slugs).toContain('test-post-001');
    });

    it('scopes post collection at build time with include filter', async () => {
      // Load without filter first to resolve a known post id
      const loaderAll = wordPressPostStaticLoader(createClient());
      const { store: storeAll, entries: entriesAll } = createMockStore();
      await loadWithStore(loaderAll, {
        logger: createMockLogger(),
        store: storeAll,
      });

      // SAFETY: The posts loader supplies numeric IDs; the next request exercises filtering with this returned ID.
      const allEntries = [...entriesAll.values()] as {
        data: { id: number; slug: string };
      }[];

      const target = allEntries.find((e) => e.data.slug === 'test-post-001')!;

      const loader = wordPressPostStaticLoader(createClient(), {
        filter: { include: [target.data.id] },
      });

      const { store, entries } = createMockStore();

      await loadWithStore(loader, { logger: createMockLogger(), store });

      expect(entries.size).toBe(1);
      expect(
        // SAFETY: The filtered posts loader must return the requested ID or slug, checked by this assertion.
        (entries.values().next().value as { data: { slug: string } }).data.slug
      ).toBe('test-post-001');
    });
  });
});
