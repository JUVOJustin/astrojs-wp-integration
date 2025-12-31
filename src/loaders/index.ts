import type { Loader, LiveLoader } from 'astro/loaders';
import type {
  WordPressPost,
  WordPressPage,
  WordPressMedia,
  WordPressCategory,
} from '../schemas';

/**
 * Configuration for WordPress loaders
 */
export interface WordPressLoaderConfig {
  baseUrl: string;
}

/**
 * Configuration for static WordPress loaders (build-time only)
 */
export interface WordPressStaticLoaderConfig extends WordPressLoaderConfig {
  /** Number of items per page (default: 100) */
  perPage?: number;
  /** Additional query parameters */
  params?: Record<string, string>;
}

/**
 * Filter options for posts
 */
export interface PostFilter {
  id?: number;
  slug?: string;
  status?: string;
  categories?: number[];
  tags?: number[];
  terms?: string;
  orderby?: 'date' | 'id' | 'title' | 'slug' | 'modified' | 'relevance';
  order?: 'asc' | 'desc';
}

/**
 * Filter options for pages
 */
export interface PageFilter {
  id?: number;
  slug?: string;
  status?: string;
}

/**
 * Filter options for media
 */
export interface MediaFilter {
  id?: number;
  slug?: string;
}

/**
 * Filter options for categories/taxonomies
 */
export interface CategoryFilter {
  id?: number;
  slug?: string;
  taxonomy?: string;
  hide_empty?: boolean;
  parent?: number;
  orderby?: 'id' | 'name' | 'slug' | 'count' | 'term_group';
  order?: 'asc' | 'desc';
}

/**
 * Fetches data from WordPress REST API
 */
async function fetchAPI<T>(
  baseUrl: string,
  endpoint: string,
  params: Record<string, string> = {}
): Promise<T> {
  const startTime = performance.now();
  const url = new URL(`${baseUrl}/index.php?rest_route=/wp/v2${endpoint}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.append(key, value));

  const response = await fetch(url.toString(), {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`WordPress API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const duration = Math.round(performance.now() - startTime);
  console.log(`[WP API] ${endpoint} - ${duration}ms - params:`, JSON.stringify(params));

  return data;
}

/**
 * Creates a live loader for WordPress posts
 * 
 * @example
 * // Basic usage
 * const posts = defineLiveCollection({
 *   loader: wordPressPostLoader({ baseUrl: 'https://example.com' }),
 *   schema: postSchema,
 * });
 * 
 * @example
 * // With custom schema for ACF fields
 * const customPostSchema = postSchema.extend({
 *   acf: z.object({
 *     video_url: z.string().optional(),
 *   }).optional(),
 * });
 * 
 * const posts = defineLiveCollection({
 *   loader: wordPressPostLoader({ baseUrl: 'https://example.com' }),
 *   schema: customPostSchema,
 * });
 */
export function wordPressPostLoader(
  config: WordPressLoaderConfig
): LiveLoader<WordPressPost, PostFilter> {
  return {
    name: 'wordpress-post-loader',
    loadCollection: async ({ filter }) => {
      try {
        const params: Record<string, string> = { per_page: '100', _embed: 'true' };
        const postFilter = (filter as any)?.filter || (filter as PostFilter | undefined);

        if (postFilter?.status) {
          params.status = postFilter.status;
        }
        if (postFilter?.categories) {
          params.categories = postFilter.categories.join(',');
        }
        if (postFilter?.tags) {
          params.tags = postFilter.tags.join(',');
        }
        if (postFilter?.terms) {
          params.terms = postFilter.terms;
        }
        if (postFilter?.orderby) {
          params.orderby = postFilter.orderby;
        }
        if (postFilter?.order) {
          params.order = postFilter.order;
        }

        const posts = await fetchAPI<WordPressPost[]>(config.baseUrl, '/posts', params);

        return {
          entries: posts.map((post) => ({
            id: String(post.id),
            data: post,
          })),
        };
      } catch (error) {
        console.error('Error in loadCollection:', error);
        return {
          error: error instanceof Error ? error : new Error('Failed to load posts'),
        };
      }
    },
    loadEntry: async ({ filter }) => {
      try {
        let post: WordPressPost | undefined;

        if (typeof filter === 'object' && 'id' in filter && filter.id) {
          post = await fetchAPI<WordPressPost>(
            config.baseUrl,
            `/posts/${filter.id}`,
            { _embed: 'true' }
          );
        } else if (typeof filter === 'object' && 'slug' in filter && filter.slug) {
          const posts = await fetchAPI<WordPressPost[]>(config.baseUrl, '/posts', {
            slug: filter.slug,
            _embed: 'true',
          });
          post = posts[0];
        }

        if (!post) {
          return {
            error: new Error('Post not found'),
          };
        }

        return {
          id: String(post.id),
          data: post,
          rendered: {
            html: post.content.rendered,
          },
        };
      } catch (error) {
        return {
          error: error instanceof Error ? error : new Error('Failed to load post'),
        };
      }
    },
  };
}

/**
 * Creates a live loader for WordPress pages
 * 
 * @example
 * const pages = defineLiveCollection({
 *   loader: wordPressPageLoader({ baseUrl: 'https://example.com' }),
 *   schema: pageSchema,
 * });
 */
export function wordPressPageLoader(
  config: WordPressLoaderConfig
): LiveLoader<WordPressPage, PageFilter> {
  return {
    name: 'wordpress-page-loader',
    loadCollection: async ({ filter }) => {
      try {
        const params: Record<string, string> = { per_page: '100', _embed: 'true' };
        const pageFilter = filter as PageFilter | undefined;

        if (pageFilter?.status) {
          params.status = pageFilter.status;
        }

        const pages = await fetchAPI<WordPressPage[]>(config.baseUrl, '/pages', params);

        return {
          entries: pages.map((page) => ({
            id: String(page.id),
            data: page,
          })),
        };
      } catch (error) {
        return {
          error: error instanceof Error ? error : new Error('Failed to load pages'),
        };
      }
    },
    loadEntry: async ({ filter }) => {
      try {
        let page: WordPressPage | undefined;

        if (typeof filter === 'object' && 'id' in filter && filter.id) {
          page = await fetchAPI<WordPressPage>(
            config.baseUrl,
            `/pages/${filter.id}`,
            { _embed: 'true' }
          );
        } else if (typeof filter === 'object' && 'slug' in filter && filter.slug) {
          const pages = await fetchAPI<WordPressPage[]>(config.baseUrl, '/pages', {
            slug: filter.slug,
            _embed: 'true',
          });
          page = pages[0];
        }

        if (!page) {
          return {
            error: new Error('Page not found'),
          };
        }

        return {
          id: String(page.id),
          data: page,
          rendered: {
            html: page.content.rendered,
          },
        };
      } catch (error) {
        return {
          error: error instanceof Error ? error : new Error('Failed to load page'),
        };
      }
    },
  };
}

/**
 * Creates a live loader for WordPress media items
 * 
 * @example
 * const media = defineLiveCollection({
 *   loader: wordPressMediaLoader({ baseUrl: 'https://example.com' }),
 *   schema: mediaSchema,
 * });
 */
export function wordPressMediaLoader(
  config: WordPressLoaderConfig
): LiveLoader<WordPressMedia, MediaFilter> {
  return {
    name: 'wordpress-media-loader',
    loadCollection: async () => {
      try {
        const media = await fetchAPI<WordPressMedia[]>(config.baseUrl, '/media', {
          per_page: '1000',
        });

        return {
          entries: media.map((item) => ({
            id: String(item.id),
            data: item,
          })),
        };
      } catch (error) {
        return {
          error: error instanceof Error ? error : new Error('Failed to load media'),
        };
      }
    },
    loadEntry: async ({ filter }) => {
      try {
        let mediaItem: WordPressMedia | undefined;

        if (typeof filter === 'object' && 'id' in filter && filter.id) {
          mediaItem = await fetchAPI<WordPressMedia>(
            config.baseUrl,
            `/media/${filter.id}`
          );
        } else if (typeof filter === 'object' && 'slug' in filter && filter.slug) {
          const mediaItems = await fetchAPI<WordPressMedia[]>(config.baseUrl, '/media', {
            slug: filter.slug,
          });
          mediaItem = mediaItems[0];
        }

        if (!mediaItem) {
          return {
            error: new Error('Media not found'),
          };
        }

        return {
          id: String(mediaItem.id),
          data: mediaItem,
        };
      } catch (error) {
        return {
          error: error instanceof Error ? error : new Error('Failed to load media'),
        };
      }
    },
  };
}

/**
 * Creates a live loader for WordPress categories/taxonomies
 * 
 * @example
 * const categories = defineLiveCollection({
 *   loader: wordPressCategoryLoader({ baseUrl: 'https://example.com' }),
 *   schema: categorySchema,
 * });
 */
export function wordPressCategoryLoader(
  config: WordPressLoaderConfig
): LiveLoader<WordPressCategory, CategoryFilter> {
  return {
    name: 'wordpress-category-loader',
    loadCollection: async ({ filter }) => {
      try {
        const params: Record<string, string> = { per_page: '100' };
        const categoryFilter = (filter as any)?.filter || (filter as CategoryFilter | undefined);

        if (categoryFilter?.hide_empty !== undefined) {
          params.hide_empty = String(categoryFilter.hide_empty);
        }
        if (categoryFilter?.parent !== undefined) {
          params.parent = String(categoryFilter.parent);
        }
        if (categoryFilter?.orderby) {
          params.orderby = categoryFilter.orderby;
        }
        if (categoryFilter?.order) {
          params.order = categoryFilter.order;
        }

        const categories = await fetchAPI<WordPressCategory[]>(
          config.baseUrl,
          '/categories',
          params
        );

        return {
          entries: categories.map((category) => ({
            id: String(category.id),
            data: category,
          })),
        };
      } catch (error) {
        return {
          error: error instanceof Error ? error : new Error('Failed to load categories'),
        };
      }
    },
    loadEntry: async ({ filter }) => {
      try {
        let category: WordPressCategory | undefined;
        const categoryFilter = filter as CategoryFilter | undefined;

        if (categoryFilter?.id) {
          category = await fetchAPI<WordPressCategory>(
            config.baseUrl,
            `/categories/${categoryFilter.id}`
          );
        } else if (categoryFilter?.slug) {
          const categories = await fetchAPI<WordPressCategory[]>(
            config.baseUrl,
            '/categories',
            { slug: categoryFilter.slug }
          );
          category = categories[0];
        }

        if (!category) {
          return {
            error: new Error('Category not found'),
          };
        }

        return {
          id: String(category.id),
          data: category,
        };
      } catch (error) {
        return {
          error: error instanceof Error ? error : new Error('Failed to load category'),
        };
      }
    },
  };
}

// =============================================================================
// STATIC LOADERS (for defineCollection - build-time only)
// =============================================================================

/**
 * Creates a static loader for WordPress posts (build-time only)
 * Use this with defineCollection for static site generation
 * 
 * @example
 * import { defineCollection } from 'astro:content';
 * import { wordPressPostStaticLoader, postSchema } from 'wp-astrojs-integration';
 * 
 * const posts = defineCollection({
 *   loader: wordPressPostStaticLoader({ baseUrl: 'https://example.com' }),
 *   schema: postSchema,
 * });
 */
export function wordPressPostStaticLoader(
  config: WordPressStaticLoaderConfig
): Loader {
  return {
    name: 'wordpress-post-static-loader',
    load: async ({ store, logger }) => {
      logger.info('Loading WordPress posts...');
      
      const params: Record<string, string> = {
        per_page: String(config.perPage || 100),
        _embed: 'true',
        ...config.params,
      };

      try {
        const posts = await fetchAPI<WordPressPost[]>(config.baseUrl, '/posts', params);
        
        store.clear();
        
        for (const post of posts) {
          store.set({
            id: String(post.id),
            data: post,
            rendered: {
              html: post.content.rendered,
            },
          });
        }
        
        logger.info(`Loaded ${posts.length} posts`);
      } catch (error) {
        logger.error(`Failed to load posts: ${error}`);
        throw error;
      }
    },
  };
}

/**
 * Creates a static loader for WordPress pages (build-time only)
 * Use this with defineCollection for static site generation
 * 
 * @example
 * import { defineCollection } from 'astro:content';
 * import { wordPressPageStaticLoader, pageSchema } from 'wp-astrojs-integration';
 * 
 * const pages = defineCollection({
 *   loader: wordPressPageStaticLoader({ baseUrl: 'https://example.com' }),
 *   schema: pageSchema,
 * });
 */
export function wordPressPageStaticLoader(
  config: WordPressStaticLoaderConfig
): Loader {
  return {
    name: 'wordpress-page-static-loader',
    load: async ({ store, logger }) => {
      logger.info('Loading WordPress pages...');
      
      const params: Record<string, string> = {
        per_page: String(config.perPage || 100),
        _embed: 'true',
        ...config.params,
      };

      try {
        const pages = await fetchAPI<WordPressPage[]>(config.baseUrl, '/pages', params);
        
        store.clear();
        
        for (const page of pages) {
          store.set({
            id: String(page.id),
            data: page,
            rendered: {
              html: page.content.rendered,
            },
          });
        }
        
        logger.info(`Loaded ${pages.length} pages`);
      } catch (error) {
        logger.error(`Failed to load pages: ${error}`);
        throw error;
      }
    },
  };
}

/**
 * Creates a static loader for WordPress media (build-time only)
 * Use this with defineCollection for static site generation
 * 
 * @example
 * import { defineCollection } from 'astro:content';
 * import { wordPressMediaStaticLoader, mediaSchema } from 'wp-astrojs-integration';
 * 
 * const media = defineCollection({
 *   loader: wordPressMediaStaticLoader({ baseUrl: 'https://example.com' }),
 *   schema: mediaSchema,
 * });
 */
export function wordPressMediaStaticLoader(
  config: WordPressStaticLoaderConfig
): Loader {
  return {
    name: 'wordpress-media-static-loader',
    load: async ({ store, logger }) => {
      logger.info('Loading WordPress media...');
      
      const params: Record<string, string> = {
        per_page: String(config.perPage || 100),
        ...config.params,
      };

      try {
        const media = await fetchAPI<WordPressMedia[]>(config.baseUrl, '/media', params);
        
        store.clear();
        
        for (const item of media) {
          store.set({
            id: String(item.id),
            data: item,
          });
        }
        
        logger.info(`Loaded ${media.length} media items`);
      } catch (error) {
        logger.error(`Failed to load media: ${error}`);
        throw error;
      }
    },
  };
}

/**
 * Creates a static loader for WordPress categories (build-time only)
 * Use this with defineCollection for static site generation
 * 
 * @example
 * import { defineCollection } from 'astro:content';
 * import { wordPressCategoryStaticLoader, categorySchema } from 'wp-astrojs-integration';
 * 
 * const categories = defineCollection({
 *   loader: wordPressCategoryStaticLoader({ baseUrl: 'https://example.com' }),
 *   schema: categorySchema,
 * });
 */
export function wordPressCategoryStaticLoader(
  config: WordPressStaticLoaderConfig
): Loader {
  return {
    name: 'wordpress-category-static-loader',
    load: async ({ store, logger }) => {
      logger.info('Loading WordPress categories...');
      
      const params: Record<string, string> = {
        per_page: String(config.perPage || 100),
        ...config.params,
      };

      try {
        const categories = await fetchAPI<WordPressCategory[]>(
          config.baseUrl,
          '/categories',
          params
        );
        
        store.clear();
        
        for (const category of categories) {
          store.set({
            id: String(category.id),
            data: category,
          });
        }
        
        logger.info(`Loaded ${categories.length} categories`);
      } catch (error) {
        logger.error(`Failed to load categories: ${error}`);
        throw error;
      }
    },
  };
}

/**
 * Creates a static loader for WordPress tags (build-time only)
 * Use this with defineCollection for static site generation
 * 
 * @example
 * import { defineCollection } from 'astro:content';
 * import { wordPressTagStaticLoader, categorySchema } from 'wp-astrojs-integration';
 * 
 * const tags = defineCollection({
 *   loader: wordPressTagStaticLoader({ baseUrl: 'https://example.com' }),
 *   schema: categorySchema,
 * });
 */
export function wordPressTagStaticLoader(
  config: WordPressStaticLoaderConfig
): Loader {
  return {
    name: 'wordpress-tag-static-loader',
    load: async ({ store, logger }) => {
      logger.info('Loading WordPress tags...');
      
      const params: Record<string, string> = {
        per_page: String(config.perPage || 100),
        ...config.params,
      };

      try {
        const tags = await fetchAPI<WordPressCategory[]>(
          config.baseUrl,
          '/tags',
          params
        );
        
        store.clear();
        
        for (const tag of tags) {
          store.set({
            id: String(tag.id),
            data: tag,
          });
        }
        
        logger.info(`Loaded ${tags.length} tags`);
      } catch (error) {
        logger.error(`Failed to load tags: ${error}`);
        throw error;
      }
    },
  };
}
