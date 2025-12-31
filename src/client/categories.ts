import type { WordPressCategory } from '../schemas';

/**
 * Categories API methods
 */
export function createCategoriesMethods(fetchAPI: <T>(endpoint: string, params?: Record<string, string>) => Promise<T>) {
  return {
    /**
     * Gets all categories
     */
    async getCategories(params: Record<string, string> = {}): Promise<WordPressCategory[]> {
      return fetchAPI<WordPressCategory[]>('/categories', { per_page: '100', ...params });
    },

    /**
     * Gets a single category by ID
     */
    async getCategory(id: number): Promise<WordPressCategory> {
      return fetchAPI<WordPressCategory>(`/categories/${id}`);
    },

    /**
     * Gets a single category by slug
     */
    async getCategoryBySlug(slug: string): Promise<WordPressCategory | undefined> {
      const categories = await fetchAPI<WordPressCategory[]>('/categories', { slug });
      return categories[0];
    },
  };
}
