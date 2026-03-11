import type { Loader } from 'astro/loaders';
import type { WordPressParsedBlock } from 'fluent-wp-client';
import { WordPressClient } from 'fluent-wp-client';
import { assertLoaderBlockAuth, loadResourceBlocks, resolveLoaderBlocksConfig } from './blocks';
import type {
  WordPressContentStaticLoaderConfig,
  WordPressStaticLoaderConfig,
  WordPressTermStaticLoaderConfig,
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
  resource?: string;
  loadEntries: (client: WordPressClient) => Promise<TEntry[]>;
  renderHtml?: (entry: TEntry) => string | undefined;
}

/**
 * Builds one Astro store entry with optional rendered HTML.
 */
function createStaticStoreEntry<TEntry extends IdentifiableEntry>(
  entry: TEntry,
  renderHtml?: (entry: TEntry) => string | undefined,
  blocks?: WordPressParsedBlock[],
): {
  id: string;
  data: (TEntry & { blocks?: WordPressParsedBlock[] }) | Record<string, unknown>;
  rendered?: { html: string };
} {
  const html = renderHtml?.(entry);
  const data = {
    ...(entry as Record<string, unknown>),
    ...(blocks ? { blocks } : {}),
  };

  if (!html) {
    return {
      id: String(entry.id),
      data,
    };
  }

  return {
    id: String(entry.id),
    data,
    rendered: { html },
  };
}

/**
 * Creates one reusable static loader backed by `WordPressClient` methods.
 */
function createStaticWordPressLoader<TEntry extends IdentifiableEntry>(
  config: WordPressStaticLoaderConfig,
  definition: StaticLoaderDefinition<TEntry>,
): Loader {
  const client = new WordPressClient(config);
  const blocksConfig = resolveLoaderBlocksConfig(config.blocks);

  return {
    name: definition.name,
    load: async ({ store, logger }) => {
      logger.info(`Loading all WordPress ${definition.logLabel}...`);

      try {
        if (blocksConfig && definition.resource) {
          assertLoaderBlockAuth(config, definition.name);
        }

        const entries = await definition.loadEntries(client);

        store.clear();

        for (const entry of entries) {
          const blocks = (blocksConfig && definition.resource)
            ? await loadResourceBlocks(client, definition.resource, entry.id, blocksConfig)
            : undefined;

          store.set(createStaticStoreEntry(entry, definition.renderHtml, blocks));
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
export function wordPressPostStaticLoader(config: WordPressStaticLoaderConfig): Loader {
  return createStaticWordPressLoader(config, {
    name: 'wordpress-post-static-loader',
    logLabel: 'posts',
    resource: 'posts',
    loadEntries: (client) => client.getAllPosts(),
    renderHtml: renderContentHtml,
  });
}

/**
 * Creates a static loader for WordPress pages.
 */
export function wordPressPageStaticLoader(config: WordPressStaticLoaderConfig): Loader {
  return createStaticWordPressLoader(config, {
    name: 'wordpress-page-static-loader',
    logLabel: 'pages',
    resource: 'pages',
    loadEntries: (client) => client.getAllPages(),
    renderHtml: renderContentHtml,
  });
}

/**
 * Creates a static loader for one custom post-like resource.
 */
export function wordPressContentStaticLoader(config: WordPressContentStaticLoaderConfig): Loader {
  const { resource, ...clientConfig } = config;

  return createStaticWordPressLoader(clientConfig, {
    name: 'wordpress-content-static-loader',
    logLabel: resource,
    resource,
    loadEntries: (client) => client.getAllContentCollection(resource),
    renderHtml: renderContentHtml,
  });
}

/**
 * Creates a static loader for WordPress media.
 */
export function wordPressMediaStaticLoader(config: WordPressStaticLoaderConfig): Loader {
  return createStaticWordPressLoader(config, {
    name: 'wordpress-media-static-loader',
    logLabel: 'media items',
    loadEntries: (client) => client.getAllMedia(),
  });
}

/**
 * Creates a static loader for WordPress categories.
 */
export function wordPressCategoryStaticLoader(config: WordPressStaticLoaderConfig): Loader {
  return createStaticWordPressLoader(config, {
    name: 'wordpress-category-static-loader',
    logLabel: 'categories',
    loadEntries: (client) => client.getAllCategories(),
  });
}

/**
 * Creates a static loader for WordPress tags.
 */
export function wordPressTagStaticLoader(config: WordPressStaticLoaderConfig): Loader {
  return createStaticWordPressLoader(config, {
    name: 'wordpress-tag-static-loader',
    logLabel: 'tags',
    loadEntries: (client) => client.getAllTags(),
  });
}

/**
 * Creates a static loader for custom taxonomy term resources.
 */
export function wordPressTermStaticLoader(config: WordPressTermStaticLoaderConfig): Loader {
  const { resource, ...clientConfig } = config;

  return createStaticWordPressLoader(clientConfig, {
    name: 'wordpress-term-static-loader',
    logLabel: resource,
    loadEntries: (client) => client.getAllTermCollection(resource),
  });
}

/**
 * Creates a static loader for WordPress users.
 */
export function wordPressUserStaticLoader(config: WordPressStaticLoaderConfig): Loader {
  return createStaticWordPressLoader(config, {
    name: 'wordpress-user-static-loader',
    logLabel: 'users',
    loadEntries: (client) => client.getAllUsers(),
  });
}
