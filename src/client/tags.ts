import type { WordPressTag } from '../schemas';

/**
 * Tags API methods
 */
export function createTagsMethods(fetchAPI: <T>(endpoint: string, params?: Record<string, string>) => Promise<T>) {
  return {
    /**
     * Gets all tags
     */
    async getTags(params: Record<string, string> = {}): Promise<WordPressTag[]> {
      return fetchAPI<WordPressTag[]>('/tags', { per_page: '100', ...params });
    },

    /**
     * Gets a single tag by ID
     */
    async getTag(id: number): Promise<WordPressTag> {
      return fetchAPI<WordPressTag>(`/tags/${id}`);
    },

    /**
     * Gets a single tag by slug
     */
    async getTagBySlug(slug: string): Promise<WordPressTag | undefined> {
      const tags = await fetchAPI<WordPressTag[]>('/tags', { slug });
      return tags[0];
    },
  };
}
