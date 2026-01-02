import type { WordPressPost } from '../schemas';
import type { FetchResult } from './index';
import type { PostsFilter, PaginatedResponse } from './types';
import { filterToParams } from './types';

/**
 * Posts API methods factory
 * Creates type-safe methods for fetching WordPress posts with filtering and pagination
 */
export function createPostsMethods(
  fetchAPI: <T>(endpoint: string, params?: Record<string, string>) => Promise<T>,
  fetchAPIPaginated: <T>(endpoint: string, params?: Record<string, string>) => Promise<FetchResult<T>>
) {
  return {
    /**
     * Gets posts with optional filtering (single page, max 100 items)
     * 
     * @param filter - Filter options (status, categories, tags, author, search, etc.)
     * @returns Array of posts matching the filter criteria
     */
    async getPosts(filter: PostsFilter = {}): Promise<WordPressPost[]> {
      const params = filterToParams({ ...filter, _embed: 'true' });
      return fetchAPI<WordPressPost[]>('/posts', params);
    },

    /**
     * Gets ALL posts by automatically paginating through all pages
     * Use this for static site generation to ensure all content is fetched
     * 
     * @param filter - Filter options (status, categories, tags, author, search, etc.)
     * @returns Array of all posts matching the filter criteria
     */
    async getAllPosts(filter: Omit<PostsFilter, 'page'> = {}): Promise<WordPressPost[]> {
      const allPosts: WordPressPost[] = [];
      let page = 1;
      let totalPages = 1;

      do {
        const params = filterToParams({ ...filter, page, perPage: 100, _embed: 'true' });
        const result = await fetchAPIPaginated<WordPressPost[]>('/posts', params);
        allPosts.push(...result.data);
        totalPages = result.totalPages;
        page++;
      } while (page <= totalPages);

      return allPosts;
    },

    /**
     * Gets posts with pagination metadata
     * 
     * @param filter - Filter options including pagination (perPage, page)
     * @returns Paginated response with posts and total counts
     */
    async getPostsPaginated(filter: PostsFilter = {}): Promise<PaginatedResponse<WordPressPost>> {
      const params = filterToParams({ ...filter, _embed: 'true' });
      const result = await fetchAPIPaginated<WordPressPost[]>('/posts', params);
      return {
        data: result.data,
        total: result.total,
        totalPages: result.totalPages,
        page: filter.page || 1,
        perPage: filter.perPage || 100,
      };
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
