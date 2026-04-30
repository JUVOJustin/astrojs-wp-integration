import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import { uneval } from 'devalue';
import type {
  WordPressClientConfig,
  WordPressDiscoveryCatalog,
  WordPressDiscoveryOptions,
} from 'fluent-wp-client';
import { WordPressClient } from 'fluent-wp-client';
import type { Plugin } from 'vite';

const DEFAULT_ENV_PREFIX = 'WP_CATALOG_';
const VIRTUAL_MODULE_ID = 'virtual:wp-astrojs/catalog';
const RESOLVED_VIRTUAL_MODULE_ID = `\0${VIRTUAL_MODULE_ID}`;
const SCHEMAS_VIRTUAL_MODULE_ID = 'virtual:wp-astrojs/schemas';
const RESOLVED_SCHEMAS_VIRTUAL_MODULE_ID = `\0${SCHEMAS_VIRTUAL_MODULE_ID}`;
const COLLECTIONS_VIRTUAL_MODULE_ID = 'virtual:wp-astrojs/collections';
const RESOLVED_COLLECTIONS_VIRTUAL_MODULE_ID = `\0${COLLECTIONS_VIRTUAL_MODULE_ID}`;
// Keep this injected consumer declaration in sync with src/env.d.ts.
const VIRTUAL_MODULE_TYPES = `declare module 'virtual:wp-astrojs/catalog' {
  import type {
    WordPressClient,
    WordPressClientConfig,
    WordPressDiscoveryCatalog,
  } from 'wp-astrojs-integration';

  export const catalog: WordPressDiscoveryCatalog | undefined;
  export const catalogPath: string | undefined;
  export const hasCatalog: boolean;

  export function seedWordPressClient<TClient extends WordPressClient>(
    client: TClient,
  ): TClient;

  export function createWordPressClient(
    config?: WordPressClientConfig,
  ): WordPressClient;

  export const defineWordPressClient: typeof createWordPressClient;
}

declare module 'virtual:wp-astrojs/schemas' {
  import type { ResourceZodSchemas } from 'wp-astrojs-integration';

  export type WordPressCatalogResourceKind = 'auto' | 'content' | 'terms' | 'resources';

  export interface WordPressCatalogSchemaOptions {
    kind?: WordPressCatalogResourceKind;
  }

  export function getWordPressResourceSchemas(
    resource: string,
    options?: WordPressCatalogSchemaOptions,
  ): ResourceZodSchemas;

  export function getWordPressContentSchemas(resource: string): ResourceZodSchemas;
  export function getWordPressTermSchemas(resource: string): ResourceZodSchemas;

  export function withWordPressActionSchemas<TOptions extends Record<string, unknown>>(
    resource: string,
    options?: TOptions & WordPressCatalogSchemaOptions,
  ): TOptions & { schema?: unknown; responseSchema?: unknown };
}

declare module 'virtual:wp-astrojs/collections' {
  import type { Loader } from 'astro/loaders';
  import type { LiveLoader } from 'astro/loaders';
  import type { WordPressClient, WordPressClientConfig } from 'wp-astrojs-integration';
  import type { WordPressCatalogResourceKind } from 'virtual:wp-astrojs/schemas';

  export interface DefineWordPressCollectionOptions {
    mode?: 'static' | 'live';
    kind?: WordPressCatalogResourceKind | 'media' | 'users';
    client?: WordPressClient;
    clientConfig?: WordPressClientConfig;
    schema?: unknown;
    loader?: Loader | LiveLoader;
    loaderOptions?: Record<string, unknown>;
  }

  export function defineWordPressCollection(
    resource: string,
    options?: DefineWordPressCollectionOptions,
  ): unknown;
}
`;

export interface WordPressCatalogIntegrationOptions {
  /** Enables discovery catalog generation and virtual module seeding. */
  enabled?: boolean;
  /** Refresh policy for the stored catalog. Defaults to build-only refreshes. */
  refresh?: 'build' | 'dev' | 'always' | 'manual';
  /** Throw when a catalog cannot be loaded or generated. Defaults to true. */
  required?: boolean;
  /** Environment variable prefix used for URL and auth values. */
  envPrefix?: string;
  /** WordPress base URL. Defaults to `${envPrefix}URL`. */
  url?: string;
  /** Resource or ability kinds to include during discovery. */
  include?: WordPressDiscoveryOptions['include'];
  /** Relative path inside Astro's cache directory. */
  cacheFile?: string;
}

export interface WordPressAstroIntegrationOptions {
  /** Discovery catalog generated from WordPress and reused by catalog-aware helpers. */
  catalog?: boolean | WordPressCatalogIntegrationOptions;
}

interface ResolvedCatalogOptions extends WordPressCatalogIntegrationOptions {
  enabled: boolean;
  refresh: NonNullable<WordPressCatalogIntegrationOptions['refresh']>;
  required: boolean;
  envPrefix: string;
  cacheFile: string;
}

interface CatalogState {
  catalog?: WordPressDiscoveryCatalog;
  catalogPath?: string;
}

function resolveCatalogOptions(
  catalog: WordPressAstroIntegrationOptions['catalog'],
): ResolvedCatalogOptions {
  if (catalog === false) {
    return {
      enabled: false,
      refresh: 'build',
      required: true,
      envPrefix: DEFAULT_ENV_PREFIX,
      cacheFile: 'wp-astrojs/catalog.json',
    };
  }

  const options = catalog === true || catalog === undefined ? {} : catalog;

  return {
    ...options,
    enabled: options.enabled ?? true,
    refresh: options.refresh ?? 'build',
    required: options.required ?? true,
    envPrefix: options.envPrefix ?? DEFAULT_ENV_PREFIX,
    cacheFile: options.cacheFile ?? 'wp-astrojs/catalog.json',
  };
}

function shouldRefreshCatalog(
  refresh: ResolvedCatalogOptions['refresh'],
  command: 'dev' | 'build' | 'preview' | 'sync',
  hasStoredCatalog: boolean,
): boolean {
  if (refresh === 'always') return true;
  if (refresh === 'manual') return false;
  if (refresh === 'build') return command === 'build' || !hasStoredCatalog;
  if (refresh === 'dev') return command === 'dev' || !hasStoredCatalog;

  return !hasStoredCatalog;
}

function readEnvValue(envPrefix: string, key: string): string | undefined {
  const value = process.env[`${envPrefix}${key}`];
  return value && value.length > 0 ? value : undefined;
}

function resolveBaseUrl(options: ResolvedCatalogOptions): string | undefined {
  return options.url ?? readEnvValue(options.envPrefix, 'URL');
}

function validateBaseUrl(baseUrl: string, envPrefix: string): string {
  try {
    return new URL(baseUrl).toString().replace(/\/$/, '');
  } catch {
    throw new Error(
      `wp-astrojs-integration catalog received an invalid WordPress URL from ${envPrefix}URL or catalog.url: ${baseUrl}`,
    );
  }
}

function resolveClientAuthConfig(
  envPrefix: string,
): Pick<WordPressClientConfig, 'auth' | 'authHeader'> {
  const authHeader = readEnvValue(envPrefix, 'AUTH_HEADER');
  if (authHeader) return { authHeader };

  const token = readEnvValue(envPrefix, 'TOKEN');
  if (token) return { auth: { token } };

  const username = readEnvValue(envPrefix, 'USERNAME');
  const password = readEnvValue(envPrefix, 'PASSWORD');
  if (username && password) {
    return { auth: { username, password } };
  }

  return {};
}

async function readStoredCatalog(
  catalogPath: URL,
): Promise<WordPressDiscoveryCatalog | undefined> {
  try {
    return JSON.parse(
      await readFile(catalogPath, 'utf-8'),
    ) as WordPressDiscoveryCatalog;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return undefined;
    }

    throw error;
  }
}

async function writeStoredCatalog(
  catalogPath: URL,
  catalog: WordPressDiscoveryCatalog,
): Promise<void> {
  await mkdir(new URL('.', catalogPath), { recursive: true });
  await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
}

function formatCatalogSummary(catalog: WordPressDiscoveryCatalog): string {
  const contentCount = Object.keys(catalog.content ?? {}).length;
  const termCount = Object.keys(catalog.terms ?? {}).length;
  const resourceCount = Object.keys(catalog.resources ?? {}).length;
  const abilityCount = Object.keys(catalog.abilities ?? {}).length;

  return `${contentCount} content resources, ${termCount} term resources, ${resourceCount} REST resources, ${abilityCount} abilities`;
}

function getCatalogSourceUrl(
  catalog: WordPressDiscoveryCatalog,
): string | undefined {
  const source = (catalog as { source?: { baseUrl?: unknown } }).source;
  return typeof source?.baseUrl === 'string' ? source.baseUrl : undefined;
}

function createCatalogVirtualModule(state: CatalogState): Plugin {
  return {
    name: 'wp-astrojs-integration:catalog',
    resolveId(id) {
      if (id === VIRTUAL_MODULE_ID) return RESOLVED_VIRTUAL_MODULE_ID;
      if (id === SCHEMAS_VIRTUAL_MODULE_ID) {
        return RESOLVED_SCHEMAS_VIRTUAL_MODULE_ID;
      }
      if (id === COLLECTIONS_VIRTUAL_MODULE_ID) {
        return RESOLVED_COLLECTIONS_VIRTUAL_MODULE_ID;
      }
      return undefined;
    },
    load(id) {
      if (id === RESOLVED_SCHEMAS_VIRTUAL_MODULE_ID) {
        return `
          import { zodSchemasFromDescription } from 'wp-astrojs-integration';
          import { catalog } from 'virtual:wp-astrojs/catalog';

          function getCatalog() {
            if (!catalog) {
              throw new Error('WordPress catalog is not available. Enable the catalog integration or set catalog.required to true so discovery failures are surfaced during Astro setup.');
            }

            return catalog;
          }

          function getDescriptionMap(kind, currentCatalog) {
            if (kind === 'content') return currentCatalog.content ?? {};
            if (kind === 'terms') return currentCatalog.terms ?? {};
            if (kind === 'resources') return currentCatalog.resources ?? {};
            return undefined;
          }

          function resolveDescription(resource, options = {}) {
            const currentCatalog = getCatalog();
            const kind = options.kind ?? 'auto';

            if (kind !== 'auto') {
              const description = getDescriptionMap(kind, currentCatalog)?.[resource];
              if (!description) {
                throw new Error(\`WordPress catalog does not contain \${kind} resource "\${resource}".\`);
              }
              return description;
            }

            const description =
              currentCatalog.content?.[resource] ??
              currentCatalog.terms?.[resource] ??
              currentCatalog.resources?.[resource];

            if (!description) {
              throw new Error(\`WordPress catalog does not contain resource "\${resource}".\`);
            }

            return description;
          }

          export function getWordPressResourceSchemas(resource, options = {}) {
            return zodSchemasFromDescription(resolveDescription(resource, options));
          }

          export function getWordPressContentSchemas(resource) {
            return getWordPressResourceSchemas(resource, { kind: 'content' });
          }

          export function getWordPressTermSchemas(resource) {
            return getWordPressResourceSchemas(resource, { kind: 'terms' });
          }

          export function withWordPressActionSchemas(resource, options = {}) {
            const { kind, ...actionOptions } = options;
            const schemas = getWordPressResourceSchemas(resource, { kind });

            return {
              ...actionOptions,
              schema: actionOptions.schema ?? schemas.create,
              responseSchema: actionOptions.responseSchema ?? schemas.item,
            };
          }
        `;
      }

      if (id === RESOLVED_COLLECTIONS_VIRTUAL_MODULE_ID) {
        return `
          import {
            wordPressCategoryLoader,
            wordPressCategoryStaticLoader,
            wordPressContentLoader,
            wordPressContentStaticLoader,
            wordPressMediaLoader,
            wordPressMediaStaticLoader,
            wordPressPageLoader,
            wordPressPageStaticLoader,
            wordPressPostLoader,
            wordPressPostStaticLoader,
            wordPressTagLoader,
            wordPressTagStaticLoader,
            wordPressTermLoader,
            wordPressTermStaticLoader,
            wordPressUserLoader,
            wordPressUserStaticLoader,
          } from 'wp-astrojs-integration';
          import { createWordPressClient } from 'virtual:wp-astrojs/catalog';
          import { getWordPressResourceSchemas } from 'virtual:wp-astrojs/schemas';

          const CONTENT_LAYER_TYPE = 'content_layer';
          const LIVE_CONTENT_TYPE = 'live';

          function resolveKind(resource, requestedKind) {
            if (requestedKind && requestedKind !== 'auto') return requestedKind;
            if (resource === 'media') return 'media';
            if (resource === 'users') return 'users';
            if (resource === 'categories' || resource === 'tags') return 'terms';
            return 'content';
          }

          function createLoader(resource, mode, kind, client, loaderOptions = {}) {
            if (loaderOptions.loader) return loaderOptions.loader;

            if (kind === 'media') {
              return mode === 'live'
                ? wordPressMediaLoader(client, loaderOptions)
                : wordPressMediaStaticLoader(client, loaderOptions);
            }

            if (kind === 'users') {
              return mode === 'live'
                ? wordPressUserLoader(client, loaderOptions)
                : wordPressUserStaticLoader(client, loaderOptions);
            }

            if (kind === 'terms') {
              if (resource === 'categories') {
                return mode === 'live'
                  ? wordPressCategoryLoader(client, loaderOptions)
                  : wordPressCategoryStaticLoader(client, loaderOptions);
              }

              if (resource === 'tags') {
                return mode === 'live'
                  ? wordPressTagLoader(client, loaderOptions)
                  : wordPressTagStaticLoader(client, loaderOptions);
              }

              return mode === 'live'
                ? wordPressTermLoader(client, { ...loaderOptions, resource })
                : wordPressTermStaticLoader(client, { ...loaderOptions, resource });
            }

            if (resource === 'posts') {
              return mode === 'live'
                ? wordPressPostLoader(client, loaderOptions)
                : wordPressPostStaticLoader(client, loaderOptions);
            }

            if (resource === 'pages') {
              return mode === 'live'
                ? wordPressPageLoader(client, loaderOptions)
                : wordPressPageStaticLoader(client, loaderOptions);
            }

            return mode === 'live'
              ? wordPressContentLoader(client, { ...loaderOptions, resource })
              : wordPressContentStaticLoader(client, { ...loaderOptions, resource });
          }

          export function defineWordPressCollection(resource, options = {}) {
            const mode = options.mode ?? 'static';
            const kind = resolveKind(resource, options.kind);
            const client = options.client ?? createWordPressClient(options.clientConfig ?? {});
            const loaderOptions = options.loaderOptions ?? {};
            const loader = options.loader ?? createLoader(resource, mode, kind, client, loaderOptions);
            const schemaKind = kind === 'media' || kind === 'users' ? 'resources' : kind;
            const schema = options.schema ?? getWordPressResourceSchemas(resource, { kind: schemaKind }).item;

            if (!schema) {
              throw new Error(\`WordPress catalog does not provide an item schema for resource "\${resource}". Pass options.schema explicitly.\`);
            }

            return {
              loader,
              schema,
              type: mode === 'live' ? LIVE_CONTENT_TYPE : CONTENT_LAYER_TYPE,
            };
          }
        `;
      }

      if (id !== RESOLVED_VIRTUAL_MODULE_ID) return undefined;

      const catalogCode = state.catalog ? uneval(state.catalog) : 'undefined';
      const catalogPathCode = state.catalogPath
        ? JSON.stringify(state.catalogPath)
        : 'undefined';

      return `
        import { WordPressClient } from 'wp-astrojs-integration';

        export const catalog = ${catalogCode};
        export const catalogPath = ${catalogPathCode};
        export const hasCatalog = Boolean(catalog);

        export function seedWordPressClient(client) {
          if (catalog) client.useCatalog(catalog);
          return client;
        }

        export function createWordPressClient(config = {}) {
          return seedWordPressClient(new WordPressClient(config));
        }

        export const defineWordPressClient = createWordPressClient;
      `;
    },
  };
}

/**
 * Adds WordPress catalog discovery to Astro projects.
 */
export default function wordpress(
  options: WordPressAstroIntegrationOptions = {},
): AstroIntegration {
  const catalogOptions = resolveCatalogOptions(options.catalog);
  const state: CatalogState = {};

  return {
    name: 'wp-astrojs-integration',
    hooks: {
      'astro:config:setup': async ({
        command,
        config,
        logger,
        updateConfig,
        addWatchFile,
      }) => {
        updateConfig({
          vite: {
            plugins: [createCatalogVirtualModule(state)],
          },
        });

        if (!catalogOptions.enabled) return;

        const catalogPath = new URL(catalogOptions.cacheFile, config.cacheDir);
        const catalogFilePath = fileURLToPath(catalogPath);
        state.catalogPath = catalogFilePath;

        const storedCatalog = await readStoredCatalog(catalogPath);
        const baseUrl = resolveBaseUrl(catalogOptions);
        const validatedBaseUrl = baseUrl
          ? validateBaseUrl(baseUrl, catalogOptions.envPrefix)
          : undefined;
        const shouldRefresh = shouldRefreshCatalog(
          catalogOptions.refresh,
          command,
          Boolean(storedCatalog),
        );

        if (!shouldRefresh && !storedCatalog) {
          const message = `WordPress catalog refresh is set to '${catalogOptions.refresh}', but no stored catalog exists at ${catalogFilePath}.`;
          if (catalogOptions.required) throw new Error(message);

          logger.warn(`${message} Continuing without a WordPress catalog.`);
          return;
        }

        if (!shouldRefresh && storedCatalog) {
          state.catalog = storedCatalog;
          addWatchFile(catalogPath);
          const catalogSourceUrl = getCatalogSourceUrl(storedCatalog);

          if (
            catalogSourceUrl &&
            validatedBaseUrl &&
            catalogSourceUrl !== validatedBaseUrl
          ) {
            logger.warn(
              `Stored WordPress catalog was generated for ${catalogSourceUrl}, but current URL is ${validatedBaseUrl}.`,
            );
          }

          logger.info(
            `WordPress catalog loaded from ${catalogFilePath} (${formatCatalogSummary(storedCatalog)})`,
          );
        } else {
          if (!validatedBaseUrl) {
            const message = `wp-astrojs-integration catalog is enabled, but ${catalogOptions.envPrefix}URL is not set.`;
            if (catalogOptions.required) throw new Error(message);

            logger.warn(`${message} Continuing without a WordPress catalog.`);
            return;
          }

          const clientConfig: WordPressClientConfig = {
            baseUrl: validatedBaseUrl,
            ...resolveClientAuthConfig(catalogOptions.envPrefix),
          };
          let catalog: WordPressDiscoveryCatalog;

          try {
            const client = new WordPressClient(clientConfig);
            catalog = await client.explore({
              include: catalogOptions.include,
              refresh: true,
            });
          } catch (error) {
            if (catalogOptions.required) throw error;

            logger.warn(
              `Failed to fetch WordPress catalog from ${validatedBaseUrl}. Continuing without a catalog.`,
            );
            return;
          }

          await writeStoredCatalog(catalogPath, catalog);
          state.catalog = catalog;
          addWatchFile(catalogPath);
          logger.info(
            `WordPress catalog written to ${catalogFilePath} (${formatCatalogSummary(catalog)})`,
          );
        }
      },
      'astro:config:done': ({ injectTypes }) => {
        injectTypes({
          filename: 'wp-astrojs-catalog.d.ts',
          content: VIRTUAL_MODULE_TYPES,
        });
      },
    },
  };
}
