import type { LiveLoader } from 'astro/loaders';
import type {
  WordPressAuthor,
  WordPressCategory,
  WordPressCustomPost,
  WordPressMedia,
  WordPressPage,
  WordPressParsedBlock,
  WordPressPost,
  WordPressTag,
} from 'fluent-wp-client';
import { WordPressClient } from 'fluent-wp-client';
import { assertLoaderBlockAuth, loadResourceBlocks, resolveLoaderBlocksConfig } from './blocks';
import type {
  CategoryFilter,
  ContentFilter,
  MediaFilter,
  PageFilter,
  PostFilter,
  TagFilter,
  TermFilter,
  WordPressContentLoaderConfig,
  WordPressTermLoaderConfig,
  UserFilter,
  WordPressLoaderConfig,
} from './types';

/**
 * Shared shape used by Astro loader entry payloads.
 */
type IdentifiableEntry = {
  id: number;
};

/**
 * Astro's live loader callbacks pass an optional wrapped filter object.
 */
type LiveLoaderContext = {
  filter?: unknown;
};

/**
 * Configuration for one reusable live loader factory.
 */
interface LiveLoaderDefinition<TEntry extends IdentifiableEntry, TFilter> {
  name: string;
  resource?: string;
  collectionError: string;
  entryError: string;
  notFoundError: string;
  loadCollectionData: (client: WordPressClient, filter: TFilter | undefined) => Promise<TEntry[]>;
  loadEntryData: (client: WordPressClient, filter: TFilter | undefined) => Promise<TEntry | undefined>;
  renderHtml?: (entry: TEntry) => string | undefined;
}

/**
 * Unwraps Astro's optional nested `filter` shape into the real loader filter.
 */
function normalizeLoaderFilter<TFilter>(filter: unknown): TFilter | undefined {
  if (typeof filter === 'object' && filter !== null && 'filter' in filter) {
    return (filter as { filter?: TFilter }).filter;
  }

  return filter as TFilter | undefined;
}

/**
 * Converts one thrown value into Astro's expected loader error shape.
 */
function createLoaderError(message: string, error: unknown): { error: Error } {
  return {
    error: error instanceof Error ? error : new Error(message),
  };
}

/**
 * Builds one Astro live loader entry with optional rendered HTML.
 */
function createLiveEntry<TEntry extends IdentifiableEntry>(
  entry: TEntry,
  renderHtml?: (entry: TEntry) => string | undefined,
  blocks?: WordPressParsedBlock[],
): {
  id: string;
  data: TEntry & { blocks?: WordPressParsedBlock[] };
  rendered?: { html: string };
} {
  const html = renderHtml?.(entry);
  const data = {
    ...(entry as Record<string, unknown>),
    ...(blocks ? { blocks } : {}),
  } as TEntry & { blocks?: WordPressParsedBlock[] };

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
 * Creates one reusable live loader backed by `WordPressClient` methods.
 */
function createLiveWordPressLoader<TEntry extends IdentifiableEntry, TFilter>(
  config: WordPressLoaderConfig,
  definition: LiveLoaderDefinition<TEntry, TFilter>,
): {
  name: string;
  loadCollection: (context: LiveLoaderContext) => Promise<{ entries: ReturnType<typeof createLiveEntry<TEntry>>[] } | { error: Error }>;
  loadEntry: (context: LiveLoaderContext) => Promise<ReturnType<typeof createLiveEntry<TEntry>> | { error: Error }>;
} {
  const client = new WordPressClient(config);
  const blocksConfig = resolveLoaderBlocksConfig(config.blocks);

  return {
    name: definition.name,
    loadCollection: async ({ filter }: LiveLoaderContext) => {
      try {
        if (blocksConfig && definition.resource) {
          assertLoaderBlockAuth(config, definition.name);
        }

        const resolvedFilter = normalizeLoaderFilter<TFilter>(filter);
        const entries = await definition.loadCollectionData(client, resolvedFilter);

        const entriesWithBlocks = await Promise.all(entries.map(async (entry) => {
          const blocks = (blocksConfig && definition.resource)
            ? await loadResourceBlocks(client, definition.resource, entry.id, blocksConfig)
            : undefined;

          return createLiveEntry(entry, definition.renderHtml, blocks);
        }));

        return {
          entries: entriesWithBlocks,
        };
      } catch (error) {
        return createLoaderError(definition.collectionError, error);
      }
    },
    loadEntry: async ({ filter }: LiveLoaderContext) => {
      try {
        if (blocksConfig && definition.resource) {
          assertLoaderBlockAuth(config, definition.name);
        }

        const resolvedFilter = normalizeLoaderFilter<TFilter>(filter);
        const entry = await definition.loadEntryData(client, resolvedFilter);

        if (!entry) {
          return createLoaderError(definition.notFoundError, new Error(definition.notFoundError));
        }

        const blocks = (blocksConfig && definition.resource)
          ? await loadResourceBlocks(client, definition.resource, entry.id, blocksConfig)
          : undefined;

        return createLiveEntry(entry, definition.renderHtml, blocks);
      } catch (error) {
        return createLoaderError(definition.entryError, error);
      }
    },
  };
}

/**
 * Resolves one post from either `id` or `slug` filter input.
 */
async function loadPostEntry(
  client: WordPressClient,
  filter: PostFilter | undefined,
): Promise<WordPressPost | undefined> {
  if (filter?.id) {
    return client.getPost(filter.id);
  }

  if (filter?.slug) {
    return client.getPostBySlug(filter.slug);
  }

  return undefined;
}

/**
 * Resolves one page from either `id` or `slug` filter input.
 */
async function loadPageEntry(
  client: WordPressClient,
  filter: PageFilter | undefined,
): Promise<WordPressPage | undefined> {
  if (filter?.id) {
    return client.getPage(filter.id);
  }

  if (filter?.slug) {
    return client.getPageBySlug(filter.slug);
  }

  return undefined;
}

/**
 * Resolves one media item from either `id` or `slug` filter input.
 */
async function loadMediaEntry(
  client: WordPressClient,
  filter: MediaFilter | undefined,
): Promise<WordPressMedia | undefined> {
  if (filter?.id) {
    return client.getMediaItem(filter.id);
  }

  if (filter?.slug) {
    return client.getMediaBySlug(filter.slug);
  }

  return undefined;
}

/**
 * Resolves one category from either `id` or `slug` filter input.
 */
async function loadCategoryEntry(
  client: WordPressClient,
  filter: CategoryFilter | undefined,
): Promise<WordPressCategory | undefined> {
  if (filter?.id) {
    return client.getCategory(filter.id);
  }

  if (filter?.slug) {
    return client.getCategoryBySlug(filter.slug);
  }

  return undefined;
}

/**
 * Resolves one tag from either `id` or `slug` filter input.
 */
async function loadTagEntry(
  client: WordPressClient,
  filter: TagFilter | undefined,
): Promise<WordPressTag | undefined> {
  if (filter?.id) {
    return client.getTag(filter.id);
  }

  if (filter?.slug) {
    return client.getTagBySlug(filter.slug);
  }

  return undefined;
}

/**
 * Maps one term filter to generic query params accepted by custom taxonomies.
 */
function createTermQueryFilter(filter: TermFilter | undefined): TermFilter {
  if (!filter) {
    return {};
  }

  const {
    id: _id,
    slug: _slug,
    hide_empty,
    hideEmpty,
    ...rest
  } = filter;

  return {
    ...rest,
    hideEmpty: hideEmpty ?? hide_empty,
  };
}

/**
 * Resolves one term from either `id` or `slug` for custom taxonomy resources.
 */
async function loadTermEntry(
  client: WordPressClient,
  resource: string,
  filter: TermFilter | undefined,
): Promise<WordPressCategory | undefined> {
  if (filter?.id) {
    return client.getTerm(resource, filter.id);
  }

  if (filter?.slug) {
    return client.getTermBySlug(resource, filter.slug);
  }

  return undefined;
}

/**
 * Resolves one user from either `id` or `slug` filter input.
 */
async function loadUserEntry(
  client: WordPressClient,
  filter: UserFilter | undefined,
): Promise<WordPressAuthor | undefined> {
  if (filter?.id) {
    return client.getUser(filter.id);
  }

  if (!filter?.slug) {
    return undefined;
  }

  const users = await client.getUsers({ search: filter.slug });
  return users.find((candidate) => candidate.slug === filter.slug);
}

/**
 * Creates a live loader for WordPress posts.
 */
export function wordPressPostLoader(
  config: WordPressLoaderConfig,
): LiveLoader<WordPressPost, PostFilter> {
  return createLiveWordPressLoader(config, {
    name: 'wordpress-post-loader',
    resource: 'posts',
    collectionError: 'Failed to load posts',
    entryError: 'Failed to load post',
    notFoundError: 'Post not found',
    loadCollectionData: (client, filter) => client.getPosts({
      status: filter?.status as never,
      categories: filter?.categories,
      tags: filter?.tags,
      orderby: filter?.orderby,
      order: filter?.order,
    }),
    loadEntryData: loadPostEntry,
    renderHtml: (entry) => entry.content.rendered,
  }) as LiveLoader<WordPressPost, PostFilter>;
}

/**
 * Creates a live loader for WordPress pages.
 */
export function wordPressPageLoader(
  config: WordPressLoaderConfig,
): LiveLoader<WordPressPage, PageFilter> {
  return createLiveWordPressLoader(config, {
    name: 'wordpress-page-loader',
    resource: 'pages',
    collectionError: 'Failed to load pages',
    entryError: 'Failed to load page',
    notFoundError: 'Page not found',
    loadCollectionData: (client, filter) => client.getPages({
      status: filter?.status as never,
    }),
    loadEntryData: loadPageEntry,
    renderHtml: (entry) => entry.content.rendered,
  }) as LiveLoader<WordPressPage, PageFilter>;
}

/**
 * Creates a live loader for one custom post-like resource.
 */
export function wordPressContentLoader(
  config: WordPressContentLoaderConfig,
): LiveLoader<WordPressCustomPost, ContentFilter> {
  const { resource, ...clientConfig } = config;

  return createLiveWordPressLoader<WordPressCustomPost, ContentFilter>(clientConfig, {
    name: 'wordpress-content-loader',
    resource,
    collectionError: `Failed to load ${resource}`,
    entryError: `Failed to load ${resource} entry`,
    notFoundError: `${resource} entry not found`,
    loadCollectionData: (client, filter: ContentFilter | undefined) => {
      if (!filter) {
        return client.getContentCollection(resource);
      }

      const { id: _id, slug: _slug, ...rest } = filter;
      return client.getContentCollection(resource, rest);
    },
    loadEntryData: async (client, filter: ContentFilter | undefined) => {
      if (filter?.id) {
        return client.getContent(resource, filter.id);
      }

      if (filter?.slug) {
        return client.getContentBySlug(resource, filter.slug);
      }

      return undefined;
    },
    renderHtml: (entry) => entry.content.rendered,
  }) as LiveLoader<WordPressCustomPost, ContentFilter>;
}

/**
 * Creates a live loader for WordPress media items.
 */
export function wordPressMediaLoader(
  config: WordPressLoaderConfig,
): LiveLoader<WordPressMedia, MediaFilter> {
  return createLiveWordPressLoader(config, {
    name: 'wordpress-media-loader',
    collectionError: 'Failed to load media',
    entryError: 'Failed to load media',
    notFoundError: 'Media not found',
    loadCollectionData: (client) => client.getAllMedia(),
    loadEntryData: loadMediaEntry,
  }) as LiveLoader<WordPressMedia, MediaFilter>;
}

/**
 * Creates a live loader for WordPress categories and taxonomies.
 */
export function wordPressCategoryLoader(
  config: WordPressLoaderConfig,
): LiveLoader<WordPressCategory, CategoryFilter> {
  return createLiveWordPressLoader(config, {
    name: 'wordpress-category-loader',
    collectionError: 'Failed to load categories',
    entryError: 'Failed to load category',
    notFoundError: 'Category not found',
    loadCollectionData: (client, filter) => client.getCategories({
      hideEmpty: filter?.hideEmpty ?? filter?.hide_empty,
      parent: filter?.parent,
      orderby: filter?.orderby,
      order: filter?.order,
    }),
    loadEntryData: loadCategoryEntry,
  }) as LiveLoader<WordPressCategory, CategoryFilter>;
}

/**
 * Creates a live loader for WordPress tags.
 */
export function wordPressTagLoader(
  config: WordPressLoaderConfig,
): LiveLoader<WordPressTag, TagFilter> {
  return createLiveWordPressLoader(config, {
    name: 'wordpress-tag-loader',
    collectionError: 'Failed to load tags',
    entryError: 'Failed to load tag',
    notFoundError: 'Tag not found',
    loadCollectionData: (client, filter) => client.getTags({
      hideEmpty: filter?.hideEmpty ?? filter?.hide_empty,
      exclude: filter?.exclude,
      include: filter?.include,
      search: filter?.search,
      orderby: filter?.orderby,
      order: filter?.order,
      page: filter?.page,
      perPage: filter?.perPage,
    }),
    loadEntryData: loadTagEntry,
  }) as LiveLoader<WordPressTag, TagFilter>;
}

/**
 * Creates a live loader for custom taxonomy term resources.
 */
export function wordPressTermLoader(
  config: WordPressTermLoaderConfig,
): LiveLoader<WordPressCategory, TermFilter> {
  const { resource, ...clientConfig } = config;

  return createLiveWordPressLoader(clientConfig, {
    name: 'wordpress-term-loader',
    collectionError: `Failed to load ${resource}`,
    entryError: `Failed to load ${resource} term`,
    notFoundError: `${resource} term not found`,
    loadCollectionData: (client, filter: TermFilter | undefined) => client.getTermCollection(resource, createTermQueryFilter(filter)),
    loadEntryData: (client, filter: TermFilter | undefined) => loadTermEntry(client, resource, filter),
  }) as LiveLoader<WordPressCategory, TermFilter>;
}

/**
 * Creates a live loader for WordPress users.
 */
export function wordPressUserLoader(
  config: WordPressLoaderConfig,
): LiveLoader<WordPressAuthor, UserFilter> {
  return createLiveWordPressLoader(config, {
    name: 'wordpress-user-loader',
    collectionError: 'Failed to load users',
    entryError: 'Failed to load user',
    notFoundError: 'User not found',
    loadCollectionData: (client, filter) => client.getUsers({
      roles: filter?.roles,
      orderby: filter?.orderby,
      order: filter?.order,
    }),
    loadEntryData: loadUserEntry,
  }) as LiveLoader<WordPressAuthor, UserFilter>;
}
