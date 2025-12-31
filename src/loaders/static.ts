import type { Loader } from 'astro/loaders';
import { WordPressClient } from '../client';
import type { WordPressStaticLoaderConfig } from './types';

/**
 * Static Loaders for WordPress content
 * Use with Astro's defineCollection for build-time static site generation
 */

/**
 * Creates a static loader for WordPress posts (build-time only)
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
export function wordPressPostStaticLoader(config: WordPressStaticLoaderConfig): Loader {
  const client = new WordPressClient({ baseUrl: config.baseUrl });

  return {
    name: 'wordpress-post-static-loader',
    load: async ({ store, logger }) => {
      logger.info('Loading WordPress posts...');

      try {
        const posts = await client.getPosts({
          per_page: String(config.perPage || 100),
          ...config.params,
        });

        store.clear();

        for (const post of posts) {
          store.set({
            id: String(post.id),
            data: post,
            rendered: { html: post.content.rendered },
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
export function wordPressPageStaticLoader(config: WordPressStaticLoaderConfig): Loader {
  const client = new WordPressClient({ baseUrl: config.baseUrl });

  return {
    name: 'wordpress-page-static-loader',
    load: async ({ store, logger }) => {
      logger.info('Loading WordPress pages...');

      try {
        const pages = await client.getPages({
          per_page: String(config.perPage || 100),
          ...config.params,
        });

        store.clear();

        for (const page of pages) {
          store.set({
            id: String(page.id),
            data: page,
            rendered: { html: page.content.rendered },
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
export function wordPressMediaStaticLoader(config: WordPressStaticLoaderConfig): Loader {
  const client = new WordPressClient({ baseUrl: config.baseUrl });

  return {
    name: 'wordpress-media-static-loader',
    load: async ({ store, logger }) => {
      logger.info('Loading WordPress media...');

      try {
        const media = await client.getMedia({
          per_page: String(config.perPage || 100),
          ...config.params,
        });

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
export function wordPressCategoryStaticLoader(config: WordPressStaticLoaderConfig): Loader {
  const client = new WordPressClient({ baseUrl: config.baseUrl });

  return {
    name: 'wordpress-category-static-loader',
    load: async ({ store, logger }) => {
      logger.info('Loading WordPress categories...');

      try {
        const categories = await client.getCategories({
          per_page: String(config.perPage || 100),
          ...config.params,
        });

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
export function wordPressTagStaticLoader(config: WordPressStaticLoaderConfig): Loader {
  const client = new WordPressClient({ baseUrl: config.baseUrl });

  return {
    name: 'wordpress-tag-static-loader',
    load: async ({ store, logger }) => {
      logger.info('Loading WordPress tags...');

      try {
        const tags = await client.getTags({
          per_page: String(config.perPage || 100),
          ...config.params,
        });

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
