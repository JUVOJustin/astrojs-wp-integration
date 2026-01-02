import type { WordPressCategory } from '../schemas';
import type { FetchResult } from './index';
import type { CategoriesFilter, PaginatedResponse } from './types';
import { filterToParams } from './types';

/**
 * Categories API methods factory
 * Creates type-safe methods for fetching WordPress categories with filtering and pagination
 */
export function createCategoriesMethods(
  fetchAPI: <T>(endpoint: string, params?: Record<string, string>) => Promise<T>,
  fetchAPIPaginated: <T>(endpoint: string, params?: Record<string, string>) => Promise<FetchResult<T>>
) {
  return {
    /**
     * Gets categories with optional filtering (single page, max 100 items)
     * 
     * @param filter - Filter options (hideEmpty, parent, include, exclude, search, etc.)
     * @returns Array of categories matching the filter criteria
     */
    async getCategories(filter: CategoriesFilter = {}): Promise<WordPressCategory[]> {
      const params = filterToParams(filter as Record<string, unknown>);
      return fetchAPI<WordPressCategory[]>('/categories', params);
    },

    /**
     * Gets ALL categories by automatically paginating through all pages
     * Use this for static site generation to ensure all content is fetched
     * 
     * @param filter - Filter options (hideEmpty, parent, include, exclude, search, etc.)
     * @returns Array of all categories matching the filter criteria
     */
    async getAllCategories(filter: Omit<CategoriesFilter, 'page'> = {}): Promise<WordPressCategory[]> {
      const allCategories: WordPressCategory[] = [];
      let page = 1;
      let totalPages = 1;

      do {
        const params = filterToParams({ ...filter, page, perPage: 100 } as Record<string, unknown>);
        const result = await fetchAPIPaginated<WordPressCategory[]>('/categories', params);
        allCategories.push(...result.data);
        totalPages = result.totalPages;
        page++;
      } while (page <= totalPages);

      return allCategories;
    },

    /**
     * Gets categories with pagination metadata
     * 
     * @param filter - Filter options including pagination (perPage, page)
     * @returns Paginated response with categories and total counts
     */
    async getCategoriesPaginated(filter: CategoriesFilter = {}): Promise<PaginatedResponse<WordPressCategory>> {
      const params = filterToParams(filter as Record<string, unknown>);
      const result = await fetchAPIPaginated<WordPressCategory[]>('/categories', params);
      return {
        data: result.data,
        total: result.total,
        totalPages: result.totalPages,
        page: filter.page || 1,
        perPage: filter.perPage || 100,
      };
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
