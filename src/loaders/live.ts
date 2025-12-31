import type { LiveLoader } from 'astro/loaders';
import type {
  WordPressPost,
  WordPressPage,
  WordPressMedia,
  WordPressCategory,
} from '../schemas';
import { WordPressClient } from '../client';
import type { WordPressLoaderConfig, PostFilter, PageFilter, MediaFilter, CategoryFilter } from './types';

/**
 * Live Loaders for WordPress content
 * Use with Astro's defineLiveCollection for server-side rendering
 */

/**
 * Creates a live loader for WordPress posts
 * 
 * @example
 * import { defineLiveCollection } from 'astro:content';
 * import { wordPressPostLoader, postSchema } from 'wp-astrojs-integration';
 * 
 * const posts = defineLiveCollection({
 *   loader: wordPressPostLoader({ baseUrl: 'https://example.com' }),
 *   schema: postSchema,
 * });
 */
export function wordPressPostLoader(
  config: WordPressLoaderConfig
): LiveLoader<WordPressPost, PostFilter> {
  const client = new WordPressClient(config.baseUrl);

  return {
    name: 'wordpress-post-loader',
    loadCollection: async ({ filter }) => {
      try {
        const params: Record<string, string> = {};
        const postFilter = (filter as any)?.filter || (filter as PostFilter | undefined);

        if (postFilter?.status) params.status = postFilter.status;
        if (postFilter?.categories) params.categories = postFilter.categories.join(',');
        if (postFilter?.tags) params.tags = postFilter.tags.join(',');
        if (postFilter?.terms) params.terms = postFilter.terms;
        if (postFilter?.orderby) params.orderby = postFilter.orderby;
        if (postFilter?.order) params.order = postFilter.order;

        const posts = await client.getPosts(params);

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
          post = await client.getPost(filter.id);
        } else if (typeof filter === 'object' && 'slug' in filter && filter.slug) {
          post = await client.getPostBySlug(filter.slug);
        }

        if (!post) {
          return { error: new Error('Post not found') };
        }

        return {
          id: String(post.id),
          data: post,
          rendered: { html: post.content.rendered },
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
 * import { defineLiveCollection } from 'astro:content';
 * import { wordPressPageLoader, pageSchema } from 'wp-astrojs-integration';
 * 
 * const pages = defineLiveCollection({
 *   loader: wordPressPageLoader({ baseUrl: 'https://example.com' }),
 *   schema: pageSchema,
 * });
 */
export function wordPressPageLoader(
  config: WordPressLoaderConfig
): LiveLoader<WordPressPage, PageFilter> {
  const client = new WordPressClient(config.baseUrl);

  return {
    name: 'wordpress-page-loader',
    loadCollection: async ({ filter }) => {
      try {
        const params: Record<string, string> = {};
        const pageFilter = filter as PageFilter | undefined;

        if (pageFilter?.status) params.status = pageFilter.status;

        const pages = await client.getPages(params);

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
          page = await client.getPage(filter.id);
        } else if (typeof filter === 'object' && 'slug' in filter && filter.slug) {
          page = await client.getPageBySlug(filter.slug);
        }

        if (!page) {
          return { error: new Error('Page not found') };
        }

        return {
          id: String(page.id),
          data: page,
          rendered: { html: page.content.rendered },
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
 * import { defineLiveCollection } from 'astro:content';
 * import { wordPressMediaLoader, mediaSchema } from 'wp-astrojs-integration';
 * 
 * const media = defineLiveCollection({
 *   loader: wordPressMediaLoader({ baseUrl: 'https://example.com' }),
 *   schema: mediaSchema,
 * });
 */
export function wordPressMediaLoader(
  config: WordPressLoaderConfig
): LiveLoader<WordPressMedia, MediaFilter> {
  const client = new WordPressClient(config.baseUrl);

  return {
    name: 'wordpress-media-loader',
    loadCollection: async () => {
      try {
        const media = await client.getMedia({ per_page: '1000' });

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
          mediaItem = await client.getMediaItem(filter.id);
        } else if (typeof filter === 'object' && 'slug' in filter && filter.slug) {
          mediaItem = await client.getMediaBySlug(filter.slug);
        }

        if (!mediaItem) {
          return { error: new Error('Media not found') };
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
 * import { defineLiveCollection } from 'astro:content';
 * import { wordPressCategoryLoader, categorySchema } from 'wp-astrojs-integration';
 * 
 * const categories = defineLiveCollection({
 *   loader: wordPressCategoryLoader({ baseUrl: 'https://example.com' }),
 *   schema: categorySchema,
 * });
 */
export function wordPressCategoryLoader(
  config: WordPressLoaderConfig
): LiveLoader<WordPressCategory, CategoryFilter> {
  const client = new WordPressClient(config.baseUrl);

  return {
    name: 'wordpress-category-loader',
    loadCollection: async ({ filter }) => {
      try {
        const params: Record<string, string> = {};
        const categoryFilter = (filter as any)?.filter || (filter as CategoryFilter | undefined);

        if (categoryFilter?.hide_empty !== undefined) params.hide_empty = String(categoryFilter.hide_empty);
        if (categoryFilter?.parent !== undefined) params.parent = String(categoryFilter.parent);
        if (categoryFilter?.orderby) params.orderby = categoryFilter.orderby;
        if (categoryFilter?.order) params.order = categoryFilter.order;

        const categories = await client.getCategories(params);

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
          category = await client.getCategory(categoryFilter.id);
        } else if (categoryFilter?.slug) {
          category = await client.getCategoryBySlug(categoryFilter.slug);
        }

        if (!category) {
          return { error: new Error('Category not found') };
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
