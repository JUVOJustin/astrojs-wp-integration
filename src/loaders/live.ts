import type { LiveLoader } from 'astro/loaders';
import type {
  WordPressAuthor,
  WordPressCategory,
  WordPressMedia,
  WordPressPage,
  WordPressPost,
} from 'fluent-wp-client';
import { WordPressClient } from 'fluent-wp-client';
import type {
  CategoryFilter,
  MediaFilter,
  PageFilter,
  PostFilter,
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
): {
  id: string;
  data: TEntry;
  rendered?: { html: string };
} {
  const html = renderHtml?.(entry);

  if (!html) {
    return {
      id: String(entry.id),
      data: entry,
    };
  }

  return {
    id: String(entry.id),
    data: entry,
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

  return {
    name: definition.name,
    loadCollection: async ({ filter }: LiveLoaderContext) => {
      try {
        const resolvedFilter = normalizeLoaderFilter<TFilter>(filter);
        const entries = await definition.loadCollectionData(client, resolvedFilter);

        return {
          entries: entries.map((entry) => createLiveEntry(entry, definition.renderHtml)),
        };
      } catch (error) {
        return createLoaderError(definition.collectionError, error);
      }
    },
    loadEntry: async ({ filter }: LiveLoaderContext) => {
      try {
        const resolvedFilter = normalizeLoaderFilter<TFilter>(filter);
        const entry = await definition.loadEntryData(client, resolvedFilter);

        if (!entry) {
          return createLoaderError(definition.notFoundError, new Error(definition.notFoundError));
        }

        return createLiveEntry(entry, definition.renderHtml);
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
      hideEmpty: filter?.hide_empty,
      parent: filter?.parent,
      orderby: filter?.orderby,
      order: filter?.order,
    }),
    loadEntryData: loadCategoryEntry,
  }) as LiveLoader<WordPressCategory, CategoryFilter>;
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
