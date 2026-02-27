import { createBasicAuthHeader, type BasicAuthCredentials } from './auth';
import { createPostsMethods } from './posts';
import { createPagesMethods } from './pages';
import { createMediaMethods } from './media';
import { createCategoriesMethods } from './categories';
import { createTagsMethods } from './tags';
import { createUsersMethods } from './users';
import { createSettingsMethods } from './settings';
import type { PaginatedResponse } from './types';

/**
 * WordPress client configuration
 */
export interface WordPressClientConfig {
  /** 
   * WordPress site URL, including any path prefix
   * Examples: 
   * - 'https://example.com'
   * - 'https://example.com/blog'
   * - 'https://example.com/en'
   */
  baseUrl: string;
  /** Authentication credentials for all API requests */
  auth?: BasicAuthCredentials;
}

/**
 * Internal fetch result with pagination headers
 */
export interface FetchResult<T> {
  data: T;
  total: number;
  totalPages: number;
}

/**
 * WordPress API Client
 * Provides direct access to WordPress REST API endpoints
 * Used internally by loaders and available for runtime data fetching
 * 
 * @example
 * // Without auth
 * const wp = new WordPressClient({ baseUrl: 'https://example.com' });
 * 
 * @example
 * // With auth
 * const wp = new WordPressClient({
 *   baseUrl: 'https://example.com',
 *   auth: { username: 'admin', password: 'app-password' }
 * });
 * 
 * @example
 * // With path prefix (e.g., multilingual site)
 * const wp = new WordPressClient({ baseUrl: 'https://example.com/en' });
 */
export class WordPressClient {
  private baseUrl: string;
  private apiBase: string;
  private authHeader: string | undefined;

  // Posts methods
  public getPosts: ReturnType<typeof createPostsMethods>['getPosts'];
  public getAllPosts: ReturnType<typeof createPostsMethods>['getAllPosts'];
  public getPostsPaginated: ReturnType<typeof createPostsMethods>['getPostsPaginated'];
  public getPost: ReturnType<typeof createPostsMethods>['getPost'];
  public getPostBySlug: ReturnType<typeof createPostsMethods>['getPostBySlug'];

  // Pages methods
  public getPages: ReturnType<typeof createPagesMethods>['getPages'];
  public getAllPages: ReturnType<typeof createPagesMethods>['getAllPages'];
  public getPagesPaginated: ReturnType<typeof createPagesMethods>['getPagesPaginated'];
  public getPage: ReturnType<typeof createPagesMethods>['getPage'];
  public getPageBySlug: ReturnType<typeof createPagesMethods>['getPageBySlug'];

  // Media methods
  public getMedia: ReturnType<typeof createMediaMethods>['getMedia'];
  public getAllMedia: ReturnType<typeof createMediaMethods>['getAllMedia'];
  public getMediaPaginated: ReturnType<typeof createMediaMethods>['getMediaPaginated'];
  public getMediaItem: ReturnType<typeof createMediaMethods>['getMediaItem'];
  public getMediaBySlug: ReturnType<typeof createMediaMethods>['getMediaBySlug'];
  public getImageUrl: ReturnType<typeof createMediaMethods>['getImageUrl'];

  // Categories methods
  public getCategories: ReturnType<typeof createCategoriesMethods>['getCategories'];
  public getAllCategories: ReturnType<typeof createCategoriesMethods>['getAllCategories'];
  public getCategoriesPaginated: ReturnType<typeof createCategoriesMethods>['getCategoriesPaginated'];
  public getCategory: ReturnType<typeof createCategoriesMethods>['getCategory'];
  public getCategoryBySlug: ReturnType<typeof createCategoriesMethods>['getCategoryBySlug'];

  // Tags methods
  public getTags: ReturnType<typeof createTagsMethods>['getTags'];
  public getAllTags: ReturnType<typeof createTagsMethods>['getAllTags'];
  public getTagsPaginated: ReturnType<typeof createTagsMethods>['getTagsPaginated'];
  public getTag: ReturnType<typeof createTagsMethods>['getTag'];
  public getTagBySlug: ReturnType<typeof createTagsMethods>['getTagBySlug'];

  // Users methods
  public getUsers: ReturnType<typeof createUsersMethods>['getUsers'];
  public getAllUsers: ReturnType<typeof createUsersMethods>['getAllUsers'];
  public getUsersPaginated: ReturnType<typeof createUsersMethods>['getUsersPaginated'];
  public getUser: ReturnType<typeof createUsersMethods>['getUser'];
  public getCurrentUser: ReturnType<typeof createUsersMethods>['getCurrentUser'];

  // Settings methods
  public getSettings: ReturnType<typeof createSettingsMethods>['getSettings'];

  constructor(config: WordPressClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.authHeader = config.auth ? createBasicAuthHeader(config.auth) : undefined;
    
    // Use WordPress REST API pretty permalinks format
    // Supports base URLs with path prefixes (e.g., https://example.com/en)
    this.apiBase = `${this.baseUrl}/wp-json/wp/v2`;

    // Bind fetchAPI and hasAuth for resource methods
    const fetchAPI = this.fetchAPI.bind(this);
    const fetchAPIPaginated = this.fetchAPIPaginated.bind(this);
    const hasAuth = this.hasAuth.bind(this);

    // Initialize resource methods
    const posts = createPostsMethods(fetchAPI, fetchAPIPaginated);
    this.getPosts = posts.getPosts;
    this.getAllPosts = posts.getAllPosts;
    this.getPostsPaginated = posts.getPostsPaginated;
    this.getPost = posts.getPost;
    this.getPostBySlug = posts.getPostBySlug;

    const pages = createPagesMethods(fetchAPI, fetchAPIPaginated);
    this.getPages = pages.getPages;
    this.getAllPages = pages.getAllPages;
    this.getPagesPaginated = pages.getPagesPaginated;
    this.getPage = pages.getPage;
    this.getPageBySlug = pages.getPageBySlug;

    const media = createMediaMethods(fetchAPI, fetchAPIPaginated);
    this.getMedia = media.getMedia;
    this.getAllMedia = media.getAllMedia;
    this.getMediaPaginated = media.getMediaPaginated;
    this.getMediaItem = media.getMediaItem;
    this.getMediaBySlug = media.getMediaBySlug;
    this.getImageUrl = media.getImageUrl;

    const categories = createCategoriesMethods(fetchAPI, fetchAPIPaginated);
    this.getCategories = categories.getCategories;
    this.getAllCategories = categories.getAllCategories;
    this.getCategoriesPaginated = categories.getCategoriesPaginated;
    this.getCategory = categories.getCategory;
    this.getCategoryBySlug = categories.getCategoryBySlug;

    const tags = createTagsMethods(fetchAPI, fetchAPIPaginated);
    this.getTags = tags.getTags;
    this.getAllTags = tags.getAllTags;
    this.getTagsPaginated = tags.getTagsPaginated;
    this.getTag = tags.getTag;
    this.getTagBySlug = tags.getTagBySlug;

    const users = createUsersMethods(fetchAPI, fetchAPIPaginated, hasAuth);
    this.getUsers = users.getUsers;
    this.getAllUsers = users.getAllUsers;
    this.getUsersPaginated = users.getUsersPaginated;
    this.getUser = users.getUser;
    this.getCurrentUser = users.getCurrentUser;

    const settings = createSettingsMethods(fetchAPI, hasAuth);
    this.getSettings = settings.getSettings;
  }

  /**
   * Checks if authentication is configured
   */
  hasAuth(): boolean {
    return this.authHeader !== undefined;
  }

  /**
   * Fetches data from WordPress REST API
   * Auth header is automatically added if configured
   * 
   * @param endpoint - API endpoint path (e.g., '/posts', '/settings')
   * @param params - Query parameters to append to the request
   */
  async fetchAPI<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    const result = await this.fetchAPIPaginated<T>(endpoint, params);
    return result.data;
  }

  /**
   * Fetches data from WordPress REST API with pagination info
   * Auth header is automatically added if configured
   * 
   * @param endpoint - API endpoint path (e.g., '/posts', '/settings')
   * @param params - Query parameters to append to the request
   * @returns Object with data and pagination headers
   */
  async fetchAPIPaginated<T>(endpoint: string, params: Record<string, string> = {}): Promise<FetchResult<T>> {
    const url = new URL(`${this.apiBase}${endpoint}`);
    Object.entries(params).forEach(([key, value]) => url.searchParams.append(key, value));

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.authHeader) {
      headers['Authorization'] = this.authHeader;
    }

    const response = await fetch(url.toString(), { headers });

    if (!response.ok) {
      throw new Error(`WordPress API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Extract pagination headers
    const total = parseInt(response.headers.get('X-WP-Total') || '0', 10);
    const totalPages = parseInt(response.headers.get('X-WP-TotalPages') || '0', 10);

    return { data, total, totalPages };
  }
}

export type { PaginatedResponse };
