import type { LiveLoader } from 'astro/loaders';
import type { WordPressPost } from '../schemas';
import { WordPressClient } from '../client';
import type { WordPressLoaderConfig, PostFilter } from './types';

export function wordPressCustomPostLoader(
  config: WordPressLoaderConfig & { postType: string }
): LiveLoader<WordPressPost, PostFilter> {
  const client = new WordPressClient(config);
  const methods = client.getCustomPostType(config.postType);

  return {
    name: `wordpress-${config.postType}-loader`,
    loadCollection: async ({ filter }) => {
      try {
        const postFilter = (filter as any)?.filter || (filter as PostFilter | undefined);
        const posts = await methods.getItems({
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
          error: error instanceof Error ? error : new Error('Failed to load items'),
        };
      }
    },
    loadEntry: async ({ filter }) => {
      try {
        let post: WordPressPost | undefined;

        if (typeof filter === 'object' && 'id' in filter && filter.id) {
          post = await methods.getItem(filter.id);
        } else if (typeof filter === 'object' && 'slug' in filter && filter.slug) {
          post = await methods.getItemBySlug(filter.slug);
        }

        if (!post) {
          return { error: new Error('Item not found') };
        }

        return {
          id: String(post.id),
          data: post,
          rendered: { html: post.content?.rendered || '' },
        };
      } catch (error) {
        return {
          error: error instanceof Error ? error : new Error('Failed to load item'),
        };
      }
    },
  };
}
