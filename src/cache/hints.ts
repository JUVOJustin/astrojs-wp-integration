import type {
  WordPressAuthor,
  WordPressCategory,
  WordPressMedia,
  WordPressPage,
  WordPressPost,
  WordPressTag,
} from 'fluent-wp-client';

/**
 * Minimal cache hint shape shared between live loaders and cache invalidation helpers.
 */
export type WordPressCacheHint = {
  tags?: string[];
  lastModified?: Date;
};

type WordPressPostLikeEntry = Pick<
  WordPressPost | WordPressPage,
  never
> & {
  id: number;
  author?: number;
  categories?: number[];
  tags?: number[];
  featured_media?: number;
  date?: string;
  date_gmt?: string;
  modified?: string;
  modified_gmt?: string;
};

type WordPressMediaLikeEntry = Pick<
  WordPressMedia,
  never
> & {
  id: number;
  author?: number;
  post?: number | null;
  date?: string;
  date_gmt?: string;
  modified?: string;
  modified_gmt?: string;
};

type WordPressTermEntry = Pick<WordPressCategory | WordPressTag, 'id' | 'taxonomy' | 'parent'>;

type WordPressUserEntry = Pick<WordPressAuthor, 'id'>;

const GLOBAL_CACHE_TAG = 'wp';

/**
 * Removes duplicate cache tags while preserving their insertion order.
 */
function dedupeTags(tags: string[]): string[] {
  return [...new Set(tags)];
}

/**
 * Parses one WordPress date string only when it is valid and usable for caching.
 */
function parseWordPressDate(value: unknown): Date | undefined {
  if (typeof value !== 'string' || value.length === 0) {
    return undefined;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed;
}

/**
 * Chooses the best available freshness timestamp from a WordPress payload.
 */
export function getWordPressLastModified(entry: {
  modified_gmt?: unknown;
  modified?: unknown;
  date_gmt?: unknown;
  date?: unknown;
}): Date | undefined {
  return parseWordPressDate(entry.modified_gmt)
    ?? parseWordPressDate(entry.modified)
    ?? parseWordPressDate(entry.date_gmt)
    ?? parseWordPressDate(entry.date);
}

/**
 * Computes the newest valid timestamp across one loader result set.
 */
function getMostRecentLastModified<TEntry extends {
  modified_gmt?: unknown;
  modified?: unknown;
  date_gmt?: unknown;
  date?: unknown;
}>(entries: TEntry[]): Date | undefined {
  let latest: Date | undefined;

  for (const entry of entries) {
    const candidate = getWordPressLastModified(entry);

    if (!candidate) {
      continue;
    }

    if (!latest || candidate > latest) {
      latest = candidate;
    }
  }

  return latest;
}

/**
 * Builds the base tag set shared by all cacheable WordPress resources.
 */
function createBaseEntryTags(resource: string, id: number): string[] {
  return [
    GLOBAL_CACHE_TAG,
    `wp:resource:${resource}`,
    `wp:entry:${resource}:${id}`,
  ];
}

/**
 * Creates narrow relationship tags for one post-like entry.
 */
function createContentRelationshipTags(entry: WordPressPostLikeEntry): string[] {
  const tags: string[] = [];

  if (typeof entry.author === 'number') {
    tags.push(`wp:author:${entry.author}`);
  }

  for (const categoryId of entry.categories ?? []) {
    tags.push(`wp:term:category:${categoryId}`);
  }

  for (const tagId of entry.tags ?? []) {
    tags.push(`wp:term:post_tag:${tagId}`);
  }

  if (typeof entry.featured_media === 'number' && entry.featured_media > 0) {
    tags.push(`wp:entry:media:${entry.featured_media}`);
  }

  return tags;
}

/**
 * Creates a cache hint for one post, page, or custom content entry.
 */
export function createContentEntryCacheHint(resource: string, entry: WordPressPostLikeEntry): WordPressCacheHint {
  return {
    tags: dedupeTags([
      ...createBaseEntryTags(resource, entry.id),
      ...createContentRelationshipTags(entry),
    ]),
    lastModified: getWordPressLastModified(entry),
  };
}

/**
 * Creates the collection-level cache hint for post-like resources.
 */
export function createContentCollectionCacheHint(
  resource: string,
  entries: WordPressPostLikeEntry[],
): WordPressCacheHint {
  return {
    tags: dedupeTags([
      GLOBAL_CACHE_TAG,
      `wp:resource:${resource}`,
    ]),
    lastModified: getMostRecentLastModified(entries),
  };
}

/**
 * Creates a cache hint for one media entry.
 */
export function createMediaEntryCacheHint(entry: WordPressMediaLikeEntry): WordPressCacheHint {
  const tags = createBaseEntryTags('media', entry.id);

  if (typeof entry.author === 'number') {
    tags.push(`wp:author:${entry.author}`);
  }

  if (typeof entry.post === 'number' && entry.post > 0) {
    tags.push(`wp:attachment-parent:${entry.post}`);
  }

  return {
    tags: dedupeTags(tags),
    lastModified: getWordPressLastModified(entry),
  };
}

/**
 * Creates the collection-level cache hint for media resources.
 */
export function createMediaCollectionCacheHint(entries: WordPressMediaLikeEntry[]): WordPressCacheHint {
  return {
    tags: dedupeTags([
      GLOBAL_CACHE_TAG,
      'wp:resource:media',
    ]),
    lastModified: getMostRecentLastModified(entries),
  };
}

/**
 * Creates a cache hint for one category, tag, or custom taxonomy term.
 */
export function createTermEntryCacheHint(resource: string, entry: WordPressTermEntry): WordPressCacheHint {
  const tags = [
    ...createBaseEntryTags(resource, entry.id),
    `wp:term:${entry.taxonomy}:${entry.id}`,
  ];

  if (typeof entry.parent === 'number' && entry.parent > 0) {
    tags.push(`wp:term:${entry.taxonomy}:${entry.parent}`);
  }

  return {
    tags: dedupeTags(tags),
  };
}

/**
 * Creates the collection-level cache hint for one taxonomy resource.
 */
export function createTermCollectionCacheHint(
  resource: string,
  entries: WordPressTermEntry[],
): WordPressCacheHint {
  const taxonomy = entries[0]?.taxonomy;

  return {
    tags: dedupeTags([
      GLOBAL_CACHE_TAG,
      `wp:resource:${resource}`,
      ...(taxonomy ? [`wp:taxonomy:${taxonomy}`] : []),
    ]),
  };
}

/**
 * Creates a cache hint for one WordPress user entry.
 */
export function createUserEntryCacheHint(entry: WordPressUserEntry): WordPressCacheHint {
  return {
    tags: dedupeTags([
      ...createBaseEntryTags('users', entry.id),
      `wp:author:${entry.id}`,
    ]),
  };
}

/**
 * Creates the collection-level cache hint for user resources.
 */
export function createUserCollectionCacheHint(): WordPressCacheHint {
  return {
    tags: [
      GLOBAL_CACHE_TAG,
      'wp:resource:users',
    ],
  };
}

/**
 * Creates the minimal invalidation tag set for one content entry change.
 */
export function createContentInvalidationTags(resource: string, id: number): string[] {
  return [`wp:entry:${resource}:${id}`];
}

/**
 * Creates the minimal invalidation tag set for one taxonomy term change.
 */
export function createTermInvalidationTags(
  resource: string,
  entry: WordPressTermEntry,
): string[] {
  return [`wp:entry:${resource}:${entry.id}`];
}

/**
 * Creates the minimal invalidation tag set for one user change.
 */
export function createUserInvalidationTags(id: number): string[] {
  return [`wp:entry:users:${id}`];
}
