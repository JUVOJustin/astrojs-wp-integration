import type { LiveLoader } from 'astro/loaders';
import type {
  WordPressAuthor,
  WordPressCategory,
  WordPressMedia,
  WordPressPage,
  WordPressPost,
  WordPressTag,
} from 'fluent-wp-client';
import { WordPressClient } from 'fluent-wp-client';
import type {
  CategoryFilter,
  ContentFilter,
  MediaFilter,
  PageFilter,
  PostFilter,
  TagFilter,
  TermFilter,
  WordPressTermLoaderOptions,
  WordPressContentLoaderOptions,
  WordPressEmbedMode,
  WordPressLiveContentLoaderOptions,
  UserFilter,
} from './types';

/**
 * Minimal embed config shared by post-like live loaders.
 */
type EmbedConfig = {
  embed?: WordPressEmbedMode;
};

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
  client: WordPressClient,
  definition: LiveLoaderDefinition<TEntry, TFilter>,
): {
  name: string;
  loadCollection: (context: LiveLoaderContext) => Promise<{ entries: ReturnType<typeof createLiveEntry<TEntry>>[] } | { error: Error }>;
  loadEntry: (context: LiveLoaderContext) => Promise<ReturnType<typeof createLiveEntry<TEntry>> | { error: Error }>;
} {
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
  options?: EmbedConfig,
): Promise<WordPressPost | undefined> {
  if (filter?.id) {
    return client.content('posts').item(filter.id, { embed: options?.embed });
  }

  if (filter?.slug) {
    return client.content('posts').item(filter.slug, { embed: options?.embed });
  }

  return undefined;
}

/**
 * Resolves one page from either `id` or `slug` filter input.
 */
async function loadPageEntry(
  client: WordPressClient,
  filter: PageFilter | undefined,
  options?: EmbedConfig,
): Promise<WordPressPage | undefined> {
  if (filter?.id) {
    return client.content('pages').item(filter.id, { embed: options?.embed });
  }

  if (filter?.slug) {
    return client.content('pages').item(filter.slug, { embed: options?.embed });
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
    return client.media().item(filter.id);
  }

  if (filter?.slug) {
    return client.media().item(filter.slug);
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
    return client.terms('categories').item(filter.id);
  }

  if (filter?.slug) {
    return client.terms('categories').item(filter.slug);
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
    return client.terms('tags').item(filter.id);
  }

  if (filter?.slug) {
    return client.terms('tags').item(filter.slug);
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
    return client.terms(resource).item(filter.id);
  }

  if (filter?.slug) {
    return client.terms(resource).item(filter.slug);
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
    return client.users().item(filter.id);
  }

  if (!filter?.slug) {
    return undefined;
  }

  const users = await client.users().list({ search: filter.slug });
  return users.find((candidate) => candidate.slug === filter.slug);
}

/**
 * Creates a live loader for WordPress posts.
 */
export function wordPressPostLoader(
  client: WordPressClient,
  options?: WordPressLiveContentLoaderOptions,
): LiveLoader<WordPressPost, PostFilter> {
  return createLiveWordPressLoader(client, {
    name: 'wordpress-post-loader',
    collectionError: 'Failed to load posts',
    entryError: 'Failed to load post',
    notFoundError: 'Post not found',
    loadCollectionData: (client, filter: PostFilter | undefined) => client.content('posts').list({
      status: filter?.status as never,
      categories: filter?.categories,
      tags: filter?.tags,
      orderby: filter?.orderby,
      order: filter?.order,
      embed: options?.embed,
    }),
    loadEntryData: (client, filter: PostFilter | undefined) => loadPostEntry(client, filter, options),
    renderHtml: (entry) => entry.content.rendered,
  }) as LiveLoader<WordPressPost, PostFilter>;
}

/**
 * Creates a live loader for WordPress pages.
 */
export function wordPressPageLoader(
  client: WordPressClient,
  options?: WordPressLiveContentLoaderOptions,
): LiveLoader<WordPressPage, PageFilter> {
  return createLiveWordPressLoader(client, {
    name: 'wordpress-page-loader',
    collectionError: 'Failed to load pages',
    entryError: 'Failed to load page',
    notFoundError: 'Page not found',
    loadCollectionData: (client, filter: PageFilter | undefined) => client.content('pages').list({
      status: filter?.status as never,
      embed: options?.embed,
    }),
    loadEntryData: (client, filter: PageFilter | undefined) => loadPageEntry(client, filter, options),
    renderHtml: (entry) => entry.content.rendered,
  }) as LiveLoader<WordPressPage, PageFilter>;
}

/**
 * Creates a live loader for WordPress media items.
 */
export function wordPressMediaLoader(
  client: WordPressClient,
): LiveLoader<WordPressMedia, MediaFilter> {
  return createLiveWordPressLoader(client, {
    name: 'wordpress-media-loader',
    collectionError: 'Failed to load media',
    entryError: 'Failed to load media',
    notFoundError: 'Media not found',
    loadCollectionData: (client) => client.media().listAll(),
    loadEntryData: loadMediaEntry,
  }) as LiveLoader<WordPressMedia, MediaFilter>;
}

/**
 * Creates a live loader for WordPress categories and taxonomies.
 */
export function wordPressCategoryLoader(
  client: WordPressClient,
): LiveLoader<WordPressCategory, CategoryFilter> {
  return createLiveWordPressLoader(client, {
    name: 'wordpress-category-loader',
    collectionError: 'Failed to load categories',
    entryError: 'Failed to load category',
    notFoundError: 'Category not found',
    loadCollectionData: (client, filter) => client.terms('categories').list({
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
  client: WordPressClient,
): LiveLoader<WordPressTag, TagFilter> {
  return createLiveWordPressLoader(client, {
    name: 'wordpress-tag-loader',
    collectionError: 'Failed to load tags',
    entryError: 'Failed to load tag',
    notFoundError: 'Tag not found',
    loadCollectionData: (client, filter) => client.terms('tags').list({
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
  client: WordPressClient,
  options: WordPressTermLoaderOptions,
): LiveLoader<WordPressCategory, TermFilter> {
  const { resource } = options;

  return createLiveWordPressLoader(client, {
    name: 'wordpress-term-loader',
    collectionError: `Failed to load ${resource}`,
    entryError: `Failed to load ${resource} term`,
    notFoundError: `${resource} term not found`,
    loadCollectionData: (client, filter: TermFilter | undefined) => client.terms(resource).list(createTermQueryFilter(filter)),
    loadEntryData: (client, filter: TermFilter | undefined) => loadTermEntry(client, resource, filter),
  }) as LiveLoader<WordPressCategory, TermFilter>;
}

/**
 * Resolves one content entry from either `id` or `slug` filter input.
 * Used for custom post types via generic content resource helpers.
 * The v3 client returns the broader post-like shape for generic resources,
 * while Astro collections still expose this loader as post-compatible data.
 */
async function loadContentEntry(
  client: WordPressClient,
  resource: string,
  filter: ContentFilter | undefined,
  options?: EmbedConfig,
): Promise<WordPressPost | undefined> {
  if (filter?.id) {
    return client.content(resource).item(filter.id, { embed: options?.embed }) as unknown as Promise<WordPressPost | undefined>;
  }

  if (filter?.slug) {
    return client.content(resource).item(filter.slug, { embed: options?.embed }) as unknown as Promise<WordPressPost | undefined>;
  }

  return undefined;
}

/**
 * Creates a live loader for WordPress users.
 */
export function wordPressUserLoader(
  client: WordPressClient,
): LiveLoader<WordPressAuthor, UserFilter> {
  return createLiveWordPressLoader(client, {
    name: 'wordpress-user-loader',
    collectionError: 'Failed to load users',
    entryError: 'Failed to load user',
    notFoundError: 'User not found',
    loadCollectionData: (client, filter) => client.users().list({
      roles: filter?.roles,
      orderby: filter?.orderby,
      order: filter?.order,
    }),
    loadEntryData: loadUserEntry,
  }) as LiveLoader<WordPressAuthor, UserFilter>;
}

/**
 * Creates a live loader for custom WordPress content resources (CPTs).
 * Aligns with fluent-wp-client's content(resource) naming.
 */
export function wordPressContentLoader(
  client: WordPressClient,
  options: WordPressContentLoaderOptions,
): LiveLoader<WordPressPost, ContentFilter> {
  const { resource, embed } = options;

  return createLiveWordPressLoader(client, {
    name: 'wordpress-content-loader',
    collectionError: `Failed to load ${resource}`,
    entryError: `Failed to load ${resource} entry`,
    notFoundError: `${resource} entry not found`,
    loadCollectionData: (client, filter: ContentFilter | undefined) => client.content(resource).list({
      status: filter?.status as never,
      categories: filter?.categories,
      tags: filter?.tags,
      orderby: filter?.orderby,
      order: filter?.order,
      perPage: filter?.perPage,
      page: filter?.page,
      embed,
    }),
    loadEntryData: (client, filter: ContentFilter | undefined) => loadContentEntry(client, resource, filter, { embed }),
    renderHtml: (entry) => entry.content?.rendered,
  }) as LiveLoader<WordPressPost, ContentFilter>;
}
