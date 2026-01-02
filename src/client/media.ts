import type { WordPressMedia } from '../schemas';
import type { FetchResult } from './index';
import type { MediaFilter, PaginatedResponse } from './types';
import { filterToParams } from './types';

/**
 * Media API methods factory
 * Creates type-safe methods for fetching WordPress media with filtering and pagination
 */
export function createMediaMethods(
  fetchAPI: <T>(endpoint: string, params?: Record<string, string>) => Promise<T>,
  fetchAPIPaginated: <T>(endpoint: string, params?: Record<string, string>) => Promise<FetchResult<T>>
) {
  return {
    /**
     * Gets media items with optional filtering (single page, max 100 items)
     * 
     * @param filter - Filter options (mediaType, mimeType, author, parent, etc.)
     * @returns Array of media items matching the filter criteria
     */
    async getMedia(filter: MediaFilter = {}): Promise<WordPressMedia[]> {
      const params = filterToParams(filter as Record<string, unknown>);
      return fetchAPI<WordPressMedia[]>('/media', params);
    },

    /**
     * Gets ALL media items by automatically paginating through all pages
     * Use this for static site generation to ensure all content is fetched
     * 
     * @param filter - Filter options (mediaType, mimeType, author, parent, etc.)
     * @returns Array of all media items matching the filter criteria
     */
    async getAllMedia(filter: Omit<MediaFilter, 'page'> = {}): Promise<WordPressMedia[]> {
      const allMedia: WordPressMedia[] = [];
      let page = 1;
      let totalPages = 1;

      do {
        const params = filterToParams({ ...filter, page, perPage: 100 } as Record<string, unknown>);
        const result = await fetchAPIPaginated<WordPressMedia[]>('/media', params);
        allMedia.push(...result.data);
        totalPages = result.totalPages;
        page++;
      } while (page <= totalPages);

      return allMedia;
    },

    /**
     * Gets media items with pagination metadata
     * 
     * @param filter - Filter options including pagination (perPage, page)
     * @returns Paginated response with media items and total counts
     */
    async getMediaPaginated(filter: MediaFilter = {}): Promise<PaginatedResponse<WordPressMedia>> {
      const params = filterToParams(filter as Record<string, unknown>);
      const result = await fetchAPIPaginated<WordPressMedia[]>('/media', params);
      return {
        data: result.data,
        total: result.total,
        totalPages: result.totalPages,
        page: filter.page || 1,
        perPage: filter.perPage || 100,
      };
    },

    /**
     * Gets a single media item by ID
     */
    async getMediaItem(id: number): Promise<WordPressMedia> {
      return fetchAPI<WordPressMedia>(`/media/${id}`);
    },

    /**
     * Gets a single media item by slug
     */
    async getMediaBySlug(slug: string): Promise<WordPressMedia | undefined> {
      const media = await fetchAPI<WordPressMedia[]>('/media', { slug });
      return media[0];
    },

    /**
     * Gets the URL for a specific media size
     * 
     * @param media - WordPress media object
     * @param size - Size name (e.g., 'thumbnail', 'medium', 'large', 'full')
     * @returns Image URL for the specified size
     */
    getImageUrl(media: WordPressMedia, size: string = 'full'): string {
      if (size === 'full' || !media.media_details.sizes[size]) {
        return media.source_url;
      }
      return media.media_details.sizes[size].source_url;
    },
  };
}
