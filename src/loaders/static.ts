import type { Loader } from 'astro/loaders';
import type {
  CategoriesFilter,
  MediaFilter as ClientMediaFilter,
  ExtensibleFilter,
  PagesFilter,
  PostsFilter,
  TagsFilter,
  UsersFilter,
  WordPressAuthor,
  WordPressCategory,
  WordPressMedia,
  WordPressPage,
  WordPressPost,
  WordPressPostLike,
  WordPressTag,
} from 'fluent-wp-client';
import { WordPressClient } from 'fluent-wp-client';
import type {
  WordPressContentStaticLoaderOptions,
  WordPressEntryMappingOptions,
  WordPressStaticLoaderOptions,
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
  content?: {
    rendered: string;
  };
};

/**
 * Configuration for one reusable static loader factory.
 */
interface StaticLoaderDefinition<TEntry extends IdentifiableEntry> {
  name: string;
  logLabel: string;
  resource: string;
  loadEntries: (client: WordPressClient) => Promise<TEntry[]>;
  mapEntry?: WordPressEntryMappingOptions<TEntry>['mapEntry'];
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
 * Applies the optional site-specific mapper before storing entries in Astro's content store.
 */
async function mapStaticEntry<TEntry extends IdentifiableEntry>(
  entry: TEntry,
  definition: StaticLoaderDefinition<TEntry>,
): Promise<TEntry> {
  return definition.mapEntry
    ? definition.mapEntry(entry, { resource: definition.resource })
    : entry;
}

/**
 * Creates one reusable static loader backed by `WordPressClient` methods.
 */
function createStaticWordPressLoader<TEntry extends IdentifiableEntry>(
  client: WordPressClient,
  definition: StaticLoaderDefinition<TEntry>,
): Loader {
  return {
    name: definition.name,
    load: async ({ store, logger }) => {
      logger.info(`Loading all WordPress ${definition.logLabel}...`);

      try {
        const entries = await definition.loadEntries(client);
        const mappedEntries = await Promise.all(
          entries.map((entry) => mapStaticEntry(entry, definition)),
        );

        store.clear();

        for (const entry of mappedEntries) {
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
function renderContentHtml(entry: RenderableEntry): string | undefined {
  return entry.content?.rendered;
}

/**
 * Creates a static loader for WordPress posts.
 */
export function wordPressPostStaticLoader(
  client: WordPressClient,
  options?: WordPressStaticLoaderOptions<
    WordPressPost,
    ExtensibleFilter<PostsFilter>
  >,
): Loader {
  return createStaticWordPressLoader<WordPressPost>(client, {
    name: 'wordpress-post-static-loader',
    logLabel: 'posts',
    resource: 'posts',
    loadEntries: (client) => client.content('posts').listAll(options?.filter),
    mapEntry: options?.mapEntry,
    renderHtml: renderContentHtml,
  });
}

/**
 * Creates a static loader for WordPress pages.
 */
export function wordPressPageStaticLoader(
  client: WordPressClient,
  options?: WordPressStaticLoaderOptions<
    WordPressPage,
    ExtensibleFilter<PagesFilter>
  >,
): Loader {
  return createStaticWordPressLoader<WordPressPage>(client, {
    name: 'wordpress-page-static-loader',
    logLabel: 'pages',
    resource: 'pages',
    loadEntries: (client) => client.content('pages').listAll(options?.filter),
    mapEntry: options?.mapEntry,
    renderHtml: renderContentHtml,
  });
}

/**
 * Creates a static loader for WordPress media.
 */
export function wordPressMediaStaticLoader(
  client: WordPressClient,
  options?: WordPressStaticLoaderOptions<
    WordPressMedia,
    ExtensibleFilter<ClientMediaFilter>
  >,
): Loader {
  return createStaticWordPressLoader<WordPressMedia>(client, {
    name: 'wordpress-media-static-loader',
    logLabel: 'media items',
    resource: 'media',
    loadEntries: (client) => client.media().listAll(options?.filter),
    mapEntry: options?.mapEntry,
  });
}

/**
 * Creates a static loader for WordPress categories.
 */
export function wordPressCategoryStaticLoader(
  client: WordPressClient,
  options?: WordPressStaticLoaderOptions<
    WordPressCategory,
    ExtensibleFilter<CategoriesFilter>
  >,
): Loader {
  return createStaticWordPressLoader<WordPressCategory>(client, {
    name: 'wordpress-category-static-loader',
    logLabel: 'categories',
    resource: 'categories',
    loadEntries: (client) =>
      client.terms('categories').listAll(options?.filter),
    mapEntry: options?.mapEntry,
  });
}

/**
 * Creates a static loader for WordPress tags.
 */
export function wordPressTagStaticLoader(
  client: WordPressClient,
  options?: WordPressStaticLoaderOptions<
    WordPressTag,
    ExtensibleFilter<TagsFilter>
  >,
): Loader {
  return createStaticWordPressLoader<WordPressTag>(client, {
    name: 'wordpress-tag-static-loader',
    logLabel: 'tags',
    resource: 'tags',
    loadEntries: (client) => client.terms('tags').listAll(options?.filter),
    mapEntry: options?.mapEntry,
  });
}

/**
 * Creates a static loader for custom taxonomy term resources.
 */
export function wordPressTermStaticLoader(
  client: WordPressClient,
  options: WordPressTermStaticLoaderOptions<WordPressCategory>,
): Loader {
  const { resource } = options;

  return createStaticWordPressLoader<WordPressCategory>(client, {
    name: 'wordpress-term-static-loader',
    logLabel: resource,
    resource,
    loadEntries: (client) => client.terms(resource).listAll(options.filter),
    mapEntry: options.mapEntry,
  });
}

/**
 * Creates a static loader for WordPress users.
 */
export function wordPressUserStaticLoader(
  client: WordPressClient,
  options?: WordPressStaticLoaderOptions<
    WordPressAuthor,
    ExtensibleFilter<UsersFilter>
  >,
): Loader {
  return createStaticWordPressLoader<WordPressAuthor>(client, {
    name: 'wordpress-user-static-loader',
    logLabel: 'users',
    resource: 'users',
    loadEntries: (client) => client.users().listAll(options?.filter),
    mapEntry: options?.mapEntry,
  });
}

/**
 * Creates a static loader for custom WordPress content resources (CPTs).
 * Aligns with fluent-wp-client's content(resource) naming.
 */
export function wordPressContentStaticLoader<
  TEntry extends WordPressPostLike = WordPressPost,
>(
  client: WordPressClient,
  options: WordPressContentStaticLoaderOptions<TEntry>,
): Loader {
  const { resource } = options;

  return createStaticWordPressLoader<TEntry>(client, {
    name: 'wordpress-content-static-loader',
    logLabel: resource,
    resource,
    loadEntries: (client) =>
      client.content<TEntry>(resource).listAll(options.filter),
    mapEntry: options.mapEntry,
    renderHtml: renderContentHtml,
  });
}
