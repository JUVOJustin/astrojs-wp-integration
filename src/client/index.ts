import {
  resolveWordPressRequestHeaders,
  type WordPressAuthConfig,
  type WordPressAuthHeaders,
  type WordPressAuthHeadersProvider,
  type WordPressAuthInput,
} from './auth';
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
  auth?: WordPressAuthConfig;
  /** Prebuilt Authorization header value for advanced auth flows */
  authHeader?: string;
  /** Request-aware auth headers for signature-based authentication flows */
  authHeaders?: WordPressAuthHeaders | WordPressAuthHeadersProvider;
  /** Cookie header string for WordPress session-based authentication */
  cookies?: string;
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
 * Low-level request options for direct calls to the WordPress REST API.
 */
export interface WordPressRequestOptions {
  /** API endpoint path (relative to `/wp-json/wp/v2`, `/wp-json/...`, or same-origin absolute URL) */
  endpoint: string;
  /** HTTP method used for the request (default: GET) */
  method?: string;
  /** Query parameters appended to the URL */
  params?: Record<string, string>;
  /** JSON-serializable body or pre-serialized body string */
  body?: unknown;
  /** Additional headers merged after auth/cookie headers */
  headers?: Record<string, string>;
  /** Per-request auth override (basic/JWT/header) */
  auth?: WordPressAuthInput;
  /** Per-request request-aware auth headers override */
  authHeaders?: WordPressAuthHeaders | WordPressAuthHeadersProvider;
  /** Per-request cookie header override */
  cookies?: string;
}

/**
 * Low-level request result with parsed payload and original response metadata.
 */
export interface WordPressRequestResult<T> {
  data: T;
  response: Response;
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
  private baseOrigin: string;
  private apiBase: string;
  private auth: WordPressAuthInput | undefined;
  private authHeaders: WordPressAuthHeaders | WordPressAuthHeadersProvider | undefined;
  private cookieHeader: string | undefined;

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
    this.baseOrigin = new URL(this.baseUrl).origin;
    this.auth = config.authHeader
      ? config.authHeader
      : config.auth;
    this.authHeaders = config.authHeaders;
    this.cookieHeader = config.cookies;
    
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
   * Rejects absolute URLs that do not target the configured WordPress origin.
   */
  private createAbsoluteApiUrl(endpoint: string): URL {
    const url = new URL(endpoint);

    if (url.origin !== this.baseOrigin) {
      throw new Error(
        `Cross-origin absolute URLs are not allowed. Expected origin '${this.baseOrigin}' but received '${url.origin}'.`
      );
    }

    return url;
  }

  /**
   * Builds one REST URL from endpoint and query params.
   */
  private createApiUrl(endpoint: string, params: Record<string, string> = {}): URL {
    const url = /^https?:\/\//i.test(endpoint)
      ? this.createAbsoluteApiUrl(endpoint)
      : endpoint.startsWith('/wp-json/')
        ? new URL(`${this.baseUrl}${endpoint}`)
        : new URL(`${this.apiBase}${endpoint}`);

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.append(key, value);
    }

    return url;
  }

  /**
   * Converts unknown body input into one request payload string.
   */
  private serializeBody(body: unknown): string | undefined {
    if (body === undefined || body === null) {
      return undefined;
    }

    if (typeof body === 'string') {
      return body;
    }

    return JSON.stringify(body);
  }

  /**
   * Resolves final request headers from auth, cookies, and caller-provided headers.
   */
  private async resolveRequestHeaders(config: {
    method: string;
    url: URL;
    body?: string;
    auth?: WordPressAuthInput;
    authHeaders?: WordPressAuthHeaders | WordPressAuthHeadersProvider;
    cookies?: string;
    headers?: Record<string, string>;
  }): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    Object.assign(
      headers,
      await resolveWordPressRequestHeaders({
        auth: config.auth,
        authHeaders: config.authHeaders,
        request: {
          method: config.method,
          url: config.url,
          body: config.body,
        },
      }),
    );

    if (config.cookies) {
      headers.Cookie = config.cookies;
    }

    if (config.headers) {
      Object.assign(headers, config.headers);
    }

    return headers;
  }

  /**
   * Parses one REST response payload based on returned content type.
   */
  private async parseResponseBody(response: Response): Promise<unknown> {
    const contentType = response.headers.get('Content-Type')?.toLowerCase() || '';

    if (contentType.includes('application/json')) {
      return response.json();
    }

    return response.text();
  }

  /**
   * Checks if authentication is configured
   */
  hasAuth(): boolean {
    return this.auth !== undefined || this.authHeaders !== undefined || this.cookieHeader !== undefined;
  }

  /**
   * Executes a low-level WordPress REST request and returns parsed response data.
   */
  async request<T = unknown>(options: WordPressRequestOptions): Promise<WordPressRequestResult<T>> {
    const method = options.method ?? 'GET';
    const url = this.createApiUrl(options.endpoint, options.params);
    const body = this.serializeBody(options.body);
    const headers = await this.resolveRequestHeaders({
      method,
      url,
      body,
      auth: options.auth ?? this.auth,
      authHeaders: options.authHeaders ?? this.authHeaders,
      cookies: options.cookies ?? this.cookieHeader,
      headers: options.headers,
    });

    const response = await fetch(url.toString(), {
      method,
      headers,
      body,
    });

    const data = await this.parseResponseBody(response) as T;

    return {
      data,
      response,
    };
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
    const { data, response } = await this.request<T>({
      endpoint,
      method: 'GET',
      params,
    });

    if (!response.ok) {
      throw new Error(`WordPress API error: ${response.status} ${response.statusText}`);
    }

    // Extract pagination headers
    const total = parseInt(response.headers.get('X-WP-Total') || '0', 10);
    const totalPages = parseInt(response.headers.get('X-WP-TotalPages') || '0', 10);

    return { data, total, totalPages };
  }
}

export type { PaginatedResponse };
