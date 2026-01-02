import type { WordPressTag } from '../schemas';
import type { FetchResult } from './index';
import type { TagsFilter, PaginatedResponse } from './types';
import { filterToParams } from './types';

/**
 * Tags API methods factory
 * Creates type-safe methods for fetching WordPress tags with filtering and pagination
 */
export function createTagsMethods(
  fetchAPI: <T>(endpoint: string, params?: Record<string, string>) => Promise<T>,
  fetchAPIPaginated: <T>(endpoint: string, params?: Record<string, string>) => Promise<FetchResult<T>>
) {
  return {
    /**
     * Gets tags with optional filtering (single page, max 100 items)
     * 
     * @param filter - Filter options (hideEmpty, include, exclude, search, etc.)
     * @returns Array of tags matching the filter criteria
     */
    async getTags(filter: TagsFilter = {}): Promise<WordPressTag[]> {
      const params = filterToParams(filter as Record<string, unknown>);
      return fetchAPI<WordPressTag[]>('/tags', params);
    },

    /**
     * Gets ALL tags by automatically paginating through all pages
     * Use this for static site generation to ensure all content is fetched
     * 
     * @param filter - Filter options (hideEmpty, include, exclude, search, etc.)
     * @returns Array of all tags matching the filter criteria
     */
    async getAllTags(filter: Omit<TagsFilter, 'page'> = {}): Promise<WordPressTag[]> {
      const allTags: WordPressTag[] = [];
      let page = 1;
      let totalPages = 1;

      do {
        const params = filterToParams({ ...filter, page, perPage: 100 } as Record<string, unknown>);
        const result = await fetchAPIPaginated<WordPressTag[]>('/tags', params);
        allTags.push(...result.data);
        totalPages = result.totalPages;
        page++;
      } while (page <= totalPages);

      return allTags;
    },

    /**
     * Gets tags with pagination metadata
     * 
     * @param filter - Filter options including pagination (perPage, page)
     * @returns Paginated response with tags and total counts
     */
    async getTagsPaginated(filter: TagsFilter = {}): Promise<PaginatedResponse<WordPressTag>> {
      const params = filterToParams(filter as Record<string, unknown>);
      const result = await fetchAPIPaginated<WordPressTag[]>('/tags', params);
      return {
        data: result.data,
        total: result.total,
        totalPages: result.totalPages,
        page: filter.page || 1,
        perPage: filter.perPage || 100,
      };
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
