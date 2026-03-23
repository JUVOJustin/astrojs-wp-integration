import type { Loader } from 'astro/loaders';
import { WordPressClient } from 'fluent-wp-client';
import type {
  WordPressContentStaticLoaderOptions,
  WordPressLoaderOptions,
  WordPressTermStaticLoaderOptions,
} from './types';

/**
 * Shared shape for static loader entries stored in Astro's content store.
 */
type IdentifiableEntry = {
  id: number;
};

/**
 * Shared shape for content entries that expose rendered HTML.
 */
type RenderableEntry = IdentifiableEntry & {
  content: {
    rendered: string;
  };
};

/**
 * Configuration for one reusable static loader factory.
 */
interface StaticLoaderDefinition<TEntry extends IdentifiableEntry> {
  name: string;
  logLabel: string;
  loadEntries: (client: WordPressClient, fields?: string[]) => Promise<TEntry[]>;
  renderHtml?: (entry: TEntry) => string | undefined;
}

/**
 * Builds one Astro store entry with optional rendered HTML.
 */
function createStaticStoreEntry<TEntry extends IdentifiableEntry>(
  entry: TEntry,
  renderHtml?: (entry: TEntry) => string | undefined,
): {
  id: string;
  data: TEntry | Record<string, unknown>;
  rendered?: { html: string };
} {
  const html = renderHtml?.(entry);

  if (!html) {
    return {
      id: String(entry.id),
      data: entry as TEntry | Record<string, unknown>,
    };
  }

  return {
    id: String(entry.id),
    data: entry,
    rendered: { html },
  };
}

/**
 * Creates one reusable static loader backed by `WordPressClient` methods.
 */
function createStaticWordPressLoader<TEntry extends IdentifiableEntry>(
  client: WordPressClient,
  definition: StaticLoaderDefinition<TEntry>,
  options: WordPressLoaderOptions = {},
): Loader {
  const { fields } = options;

  return {
    name: definition.name,
    load: async ({ store, logger }) => {
      logger.info(`Loading all WordPress ${definition.logLabel}...`);

      try {
        const entries = await definition.loadEntries(client, fields);

        store.clear();

        for (const entry of entries) {
          store.set(createStaticStoreEntry(entry, definition.renderHtml));
        }

        logger.info(`Loaded ${entries.length} ${definition.logLabel}`);
      } catch (error) {
        logger.error(`Failed to load ${definition.logLabel}: ${error}`);
        throw error;
      }
    },
  };
}

/**
 * Reads rendered HTML from one content entry.
 */
function renderContentHtml(entry: RenderableEntry): string {
  return entry.content.rendered;
}

/**
 * Creates a static loader for WordPress posts.
 */
export function wordPressPostStaticLoader(
  client: WordPressClient,
  options: WordPressLoaderOptions = {},
): Loader {
  return createStaticWordPressLoader(
    client,
    {
      name: 'wordpress-post-static-loader',
      logLabel: 'posts',
      loadEntries: (client, fields) => client.getAllPosts(fields ? { fields } : undefined),
      renderHtml: renderContentHtml,
    },
    options,
  );
}

/**
 * Creates a static loader for WordPress pages.
 */
export function wordPressPageStaticLoader(
  client: WordPressClient,
  options: WordPressLoaderOptions = {},
): Loader {
  return createStaticWordPressLoader(
    client,
    {
      name: 'wordpress-page-static-loader',
      logLabel: 'pages',
      loadEntries: (client, fields) => client.getAllPages(fields ? { fields } : undefined),
      renderHtml: renderContentHtml,
    },
    options,
  );
}

/**
 * Creates a static loader for WordPress media.
 */
export function wordPressMediaStaticLoader(
  client: WordPressClient,
  options: WordPressLoaderOptions = {},
): Loader {
  return createStaticWordPressLoader(
    client,
    {
      name: 'wordpress-media-static-loader',
      logLabel: 'media items',
      loadEntries: (client, fields) => client.getAllMedia(fields ? { fields } : undefined),
    },
    options,
  );
}

/**
 * Creates a static loader for WordPress categories.
 */
export function wordPressCategoryStaticLoader(
  client: WordPressClient,
  options: WordPressLoaderOptions = {},
): Loader {
  return createStaticWordPressLoader(
    client,
    {
      name: 'wordpress-category-static-loader',
      logLabel: 'categories',
      loadEntries: (client, fields) => client.getAllCategories(fields ? { fields } : undefined),
    },
    options,
  );
}

/**
 * Creates a static loader for WordPress tags.
 */
export function wordPressTagStaticLoader(
  client: WordPressClient,
  options: WordPressLoaderOptions = {},
): Loader {
  return createStaticWordPressLoader(
    client,
    {
      name: 'wordpress-tag-static-loader',
      logLabel: 'tags',
      loadEntries: (client, fields) => client.getAllTags(fields ? { fields } : undefined),
    },
    options,
  );
}

/**
 * Creates a static loader for custom taxonomy term resources.
 */
export function wordPressTermStaticLoader(
  client: WordPressClient,
  options: WordPressTermStaticLoaderOptions,
): Loader {
  const { resource, fields } = options;

  return createStaticWordPressLoader(
    client,
    {
      name: 'wordpress-term-static-loader',
      logLabel: resource,
      loadEntries: (client, loaderFields) =>
        client.getAllTermCollection(resource, loaderFields ? { fields: loaderFields } : undefined),
    },
    { fields },
  );
}

/**
 * Creates a static loader for WordPress users.
 */
export function wordPressUserStaticLoader(
  client: WordPressClient,
  options: WordPressLoaderOptions = {},
): Loader {
  return createStaticWordPressLoader(
    client,
    {
      name: 'wordpress-user-static-loader',
      logLabel: 'users',
      loadEntries: (client, fields) => client.getAllUsers(fields ? { fields } : undefined),
    },
    options,
  );
}

/**
 * Creates a static loader for custom WordPress content resources (CPTs).
 * Aligns with fluent-wp-client's content(resource) naming.
 */
export function wordPressContentStaticLoader(
  client: WordPressClient,
  options: WordPressContentStaticLoaderOptions,
): Loader {
  const { resource, fields } = options;

  return createStaticWordPressLoader(
    client,
    {
      name: 'wordpress-content-static-loader',
      logLabel: resource,
      loadEntries: (client, loaderFields) =>
        client.getAllContentCollection(resource, loaderFields ? { fields: loaderFields } : undefined),
      renderHtml: renderContentHtml,
    },
    { fields },
  );
}
