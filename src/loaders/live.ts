import type { LiveLoader } from 'astro/loaders';
import type {
  WordPressPost,
  WordPressPage,
  WordPressMedia,
  WordPressCategory,
  WordPressAuthor,
} from '../schemas';
import { WordPressClient } from '../client';
import type { BasicAuthCredentials } from '../client/auth';

/**
 * Loader configuration for WordPress content
 */
export interface WordPressLoaderConfig {
  baseUrl: string;
  auth?: BasicAuthCredentials;
}

/**
 * Filter options for posts (live loader)
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
 * Filter options for pages (live loader)
 */
export interface PageFilter {
  id?: number;
  slug?: string;
  status?: string;
}

/**
 * Filter options for media (live loader)
 */
export interface LiveMediaFilter {
  id?: number;
  slug?: string;
}

/**
 * Filter options for categories/taxonomies (live loader)
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
 * Filter options for users (live loader)
 */
export interface UserFilter {
  id?: number;
  slug?: string;
  roles?: string[];
  orderby?: 'id' | 'name' | 'slug' | 'email' | 'url' | 'registered_date';
  order?: 'asc' | 'desc';
}

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
  const client = new WordPressClient(config);

  return {
    name: 'wordpress-post-loader',
    loadCollection: async ({ filter }) => {
      try {
        const postFilter = (filter as any)?.filter || (filter as PostFilter | undefined);

        const posts = await client.getPosts({
          status: postFilter?.status as any,
          categories: postFilter?.categories,
          tags: postFilter?.tags,
          orderby: postFilter?.orderby,
          order: postFilter?.order,
        });

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
  const client = new WordPressClient(config);

  return {
    name: 'wordpress-page-loader',
    loadCollection: async ({ filter }) => {
      try {
        const pageFilter = filter as PageFilter | undefined;

        const pages = await client.getPages({
          status: pageFilter?.status as any,
        });

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
): LiveLoader<WordPressMedia, LiveMediaFilter> {
  const client = new WordPressClient(config);

  return {
    name: 'wordpress-media-loader',
    loadCollection: async () => {
      try {
        const media = await client.getMedia({ perPage: 1000 });

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
  const client = new WordPressClient(config);

  return {
    name: 'wordpress-category-loader',
    loadCollection: async ({ filter }) => {
      try {
        const categoryFilter = (filter as any)?.filter || (filter as CategoryFilter | undefined);

        const categories = await client.getCategories({
          hideEmpty: categoryFilter?.hide_empty,
          parent: categoryFilter?.parent,
          orderby: categoryFilter?.orderby,
          order: categoryFilter?.order,
        });

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

/**
 * Creates a live loader for WordPress users
 *
 * @example
 * import { defineLiveCollection } from 'astro:content';
 * import { wordPressUserLoader } from 'wp-astrojs-integration';
 *
 * const users = defineLiveCollection({
 *   loader: wordPressUserLoader({ baseUrl: 'https://example.com' }),
 * });
 */
export function wordPressUserLoader(
  config: WordPressLoaderConfig
): LiveLoader<WordPressAuthor, UserFilter> {
  const client = new WordPressClient(config);

  return {
    name: 'wordpress-user-loader',
    loadCollection: async ({ filter }) => {
      try {
        const userFilter = (filter as any)?.filter || (filter as UserFilter | undefined);

        const users = await client.getUsers({
          roles: userFilter?.roles,
          orderby: userFilter?.orderby,
          order: userFilter?.order,
        });

        return {
          entries: users.map((user) => ({
            id: String(user.id),
            data: user,
          })),
        };
      } catch (error) {
        return {
          error: error instanceof Error ? error : new Error('Failed to load users'),
        };
      }
    },
    loadEntry: async ({ filter }) => {
      try {
        let user: WordPressAuthor | undefined;

        if (typeof filter === 'object' && 'id' in filter && filter.id) {
          user = await client.getUser(filter.id);
        } else if (typeof filter === 'object' && 'slug' in filter && filter.slug) {
          const users = await client.getUsers({ search: filter.slug });
          user = users.find((candidate) => candidate.slug === filter.slug);
        }

        if (!user) {
          return { error: new Error('User not found') };
        }

        return {
          id: String(user.id),
          data: user,
        };
      } catch (error) {
        return {
          error: error instanceof Error ? error : new Error('Failed to load user'),
        };
      }
    },
  };
}
