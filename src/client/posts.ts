import type { WordPressPost } from '../schemas';

/**
 * Posts API methods
 */
export function createPostsMethods(fetchAPI: <T>(endpoint: string, params?: Record<string, string>) => Promise<T>) {
  return {
    /**
     * Gets all posts
     */
    async getPosts(params: Record<string, string> = {}): Promise<WordPressPost[]> {
      return fetchAPI<WordPressPost[]>('/posts', {
        per_page: '100',
        _embed: 'true',
        ...params,
      });
    },

    /**
     * Gets a single post by ID
     */
    async getPost(id: number): Promise<WordPressPost> {
      return fetchAPI<WordPressPost>(`/posts/${id}`, { _embed: 'true' });
    },

    /**
     * Gets a single post by slug
     */
    async getPostBySlug(slug: string): Promise<WordPressPost | undefined> {
      const posts = await fetchAPI<WordPressPost[]>('/posts', { slug, _embed: 'true' });
      return posts[0];
    },
  };
}
