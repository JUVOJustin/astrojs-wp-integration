import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
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
const GENERATED_SCHEMAS_VIRTUAL_MODULE_ID =
  'virtual:wp-astrojs/generated-schemas';
const RESOLVED_GENERATED_SCHEMAS_VIRTUAL_MODULE_ID = `\0${GENERATED_SCHEMAS_VIRTUAL_MODULE_ID}`;
const execFileAsync = promisify(execFile);
// Keep this injected consumer declaration in sync with src/env.d.ts.
const BASE_VIRTUAL_MODULE_TYPES = `declare module 'virtual:wp-astrojs/catalog' {
  import type {
    WordPressClient,
    WordPressClientConfig,
    WordPressDiscoveryCatalog,
  } from 'fluent-wp-client';

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
  import type { ResourceZodSchemas } from 'fluent-wp-client/zod';

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
  import type { BaseSchema } from 'astro:content';
  import type { Loader } from 'astro/loaders';
  import type { LiveLoader } from 'astro/loaders';
  import type { WordPressClient, WordPressClientConfig } from 'fluent-wp-client';
  import type { WordPressGeneratedResourceSchemas } from 'virtual:wp-astrojs/generated-schemas';
  import type { WordPressCatalogResourceKind } from 'virtual:wp-astrojs/schemas';

  export interface DefineWordPressCollectionOptions<TSchema extends BaseSchema = BaseSchema> {
    mode?: 'static' | 'live';
    kind?: WordPressCatalogResourceKind | 'media' | 'users';
    client?: WordPressClient;
    clientConfig?: WordPressClientConfig;
    schema?: TSchema;
    loader?: Loader | LiveLoader;
    loaderOptions?: Record<string, unknown>;
  }

  export type GeneratedWordPressSchema<TResource extends keyof WordPressGeneratedResourceSchemas> =
    WordPressGeneratedResourceSchemas[TResource] extends BaseSchema
      ? WordPressGeneratedResourceSchemas[TResource]
      : BaseSchema;

  export function defineWordPressCollection<
    TResource extends keyof WordPressGeneratedResourceSchemas,
    TSchema extends BaseSchema = GeneratedWordPressSchema<TResource>,
  >(
    resource: TResource,
    options?: DefineWordPressCollectionOptions<TSchema>,
  ): {
    type: 'content_layer' | 'live';
    schema: TSchema;
    loader: Loader | LiveLoader;
  };

  export function defineWordPressCollection<TSchema extends BaseSchema = BaseSchema>(
    resource: string,
    options?: DefineWordPressCollectionOptions<TSchema>,
  ): {
    type: 'content_layer' | 'live';
    schema: TSchema;
    loader: Loader | LiveLoader;
  };
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
  generatedSchemasPath?: string;
  generatedSchemaTypes?: string;
  generatedResources?: GeneratedSchemaResource[];
}

interface GeneratedSchemaResource {
  resource: string;
  schemaName: string;
  typeName: string;
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

function toPascalCase(slug: string): string {
  return slug
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function createGeneratedSchemaResource(
  resource: string,
  description: { resource?: string; restBase?: string; slug?: string },
): GeneratedSchemaResource {
  const slug = description.slug ?? description.resource ?? resource;
  const pascal = toPascalCase(slug);

  return {
    resource: description.restBase ?? resource,
    schemaName: `wp${pascal}Schema`,
    typeName: `WP${pascal}`,
  };
}

function getGeneratedSchemaResources(
  catalog: WordPressDiscoveryCatalog | undefined,
): GeneratedSchemaResource[] {
  if (!catalog) return [];

  return [
    ...Object.entries(catalog.content ?? {}).map(([resource, description]) =>
      createGeneratedSchemaResource(resource, description),
    ),
    ...Object.entries(catalog.terms ?? {}).map(([resource, description]) =>
      createGeneratedSchemaResource(resource, description),
    ),
  ];
}

function getFluentWpClientCliPath(): string {
  const packageRoot = resolve(
    dirname(fileURLToPath(import.meta.resolve('fluent-wp-client'))),
    '..',
  );
  const packageJson = JSON.parse(
    readFileSync(join(packageRoot, 'package.json'), 'utf-8'),
  ) as { bin?: { 'fluent-wp-client'?: string } };
  const binPath = packageJson.bin?.['fluent-wp-client'];

  if (!binPath) {
    throw new Error('fluent-wp-client does not expose a CLI bin path.');
  }

  return resolve(packageRoot, binPath);
}

function createSchemaCliArgs(
  baseUrl: string,
  zodOut: string,
  typesOut: string,
): string[] {
  return [
    getFluentWpClientCliPath(),
    'schemas',
    '--url',
    baseUrl,
    '--zod-out',
    zodOut,
    '--types-out',
    typesOut,
  ];
}

function createSchemaCliEnv(
  options: ResolvedCatalogOptions,
): NodeJS.ProcessEnv {
  const authHeader = readEnvValue(options.envPrefix, 'AUTH_HEADER');
  const token = readEnvValue(options.envPrefix, 'TOKEN');
  const username = readEnvValue(options.envPrefix, 'USERNAME');
  const password = readEnvValue(options.envPrefix, 'PASSWORD');

  const env: NodeJS.ProcessEnv = {};

  if (authHeader) {
    env.FLUENT_WP_AUTH_HEADER = authHeader;
  } else if (token) {
    env.FLUENT_WP_TOKEN = token;
  } else if (username && password) {
    env.FLUENT_WP_USERNAME = username;
    env.FLUENT_WP_PASSWORD = password;
  }

  return env;
}

async function generateSchemaArtifacts(
  options: ResolvedCatalogOptions,
  baseUrl: string,
  zodOut: string,
  typesOut: string,
): Promise<void> {
  await execFileAsync(
    process.execPath,
    createSchemaCliArgs(baseUrl, zodOut, typesOut),
    {
      env: {
        ...process.env,
        ...createSchemaCliEnv(options),
      },
    },
  );
}

async function readGeneratedFile(
  filePath: string,
): Promise<string | undefined> {
  try {
    return await readFile(filePath, 'utf-8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return undefined;
    }

    throw error;
  }
}

function filterGeneratedResources(
  resources: GeneratedSchemaResource[],
  zodModule: string | undefined,
  typeDeclarations: string | undefined,
): GeneratedSchemaResource[] {
  if (!zodModule || !typeDeclarations) return [];

  return resources.filter(
    (resource) =>
      zodModule.includes(`export const ${resource.schemaName} =`) &&
      (typeDeclarations.includes(`interface ${resource.typeName} `) ||
        typeDeclarations.includes(`type ${resource.typeName} =`)),
  );
}

function createGeneratedSchemasModule(state: CatalogState): string {
  const resources = state.generatedResources ?? [];

  if (!state.generatedSchemasPath || resources.length === 0) {
    return 'export const wordPressGeneratedSchemaMap = {};';
  }

  const moduleUrl = pathToFileURL(state.generatedSchemasPath).href;
  const entries = resources.map(
    (resource) =>
      `${JSON.stringify(resource.resource)}: generated.${resource.schemaName}`,
  );

  return `
    import * as generated from ${JSON.stringify(moduleUrl)};
    export * from ${JSON.stringify(moduleUrl)};

    export const wordPressGeneratedSchemaMap = Object.assign(Object.create(null), {
      ${entries.join(',\n      ')}
    });
  `;
}

function createGeneratedSchemasTypes(state: CatalogState): string {
  const resources = state.generatedResources ?? [];
  const typeDeclarations = state.generatedSchemaTypes ?? '';
  const schemaDeclarations = resources.map(
    (resource) =>
      `export const ${resource.schemaName}: ZodType<${resource.typeName}>;`,
  );
  const mapEntries = resources.map(
    (resource) =>
      `${JSON.stringify(resource.resource)}: typeof ${resource.schemaName};`,
  );

  return `declare module 'virtual:wp-astrojs/generated-schemas' {
  import type { ZodType } from 'zod';

  ${typeDeclarations}

  ${schemaDeclarations.join('\n  ')}

  export interface WordPressGeneratedResourceSchemas {
    ${mapEntries.join('\n    ')}
  }

  export const wordPressGeneratedSchemaMap: WordPressGeneratedResourceSchemas;
}
`;
}

function createVirtualModuleTypes(state: CatalogState): string {
  return `${BASE_VIRTUAL_MODULE_TYPES}\n${createGeneratedSchemasTypes(state)}`;
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
      if (id === GENERATED_SCHEMAS_VIRTUAL_MODULE_ID) {
        return RESOLVED_GENERATED_SCHEMAS_VIRTUAL_MODULE_ID;
      }
      return undefined;
    },
    load(id) {
      if (id === RESOLVED_GENERATED_SCHEMAS_VIRTUAL_MODULE_ID) {
        return createGeneratedSchemasModule(state);
      }

      if (id === RESOLVED_SCHEMAS_VIRTUAL_MODULE_ID) {
        return `
          import { zodSchemasFromDescription } from 'fluent-wp-client/zod';
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
          import { wordPressGeneratedSchemaMap } from 'virtual:wp-astrojs/generated-schemas';

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
            const generatedSchema = Object.hasOwn(wordPressGeneratedSchemaMap, resource)
              ? wordPressGeneratedSchemaMap[resource]
              : undefined;
            const schema = options.schema ?? generatedSchema ?? getWordPressResourceSchemas(resource, { kind: schemaKind }).item;

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
        import { WordPressClient } from 'fluent-wp-client';

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
        const generatedSchemasPath = new URL(
          'wp-astrojs/generated-schemas.mjs',
          config.cacheDir,
        );
        const generatedSchemaTypesPath = new URL(
          'wp-astrojs/generated-schemas.d.ts',
          config.cacheDir,
        );
        const catalogFilePath = fileURLToPath(catalogPath);
        const generatedSchemasFilePath = fileURLToPath(generatedSchemasPath);
        const generatedSchemaTypesFilePath = fileURLToPath(
          generatedSchemaTypesPath,
        );
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

        const catalogGeneratedResources = getGeneratedSchemaResources(
          state.catalog,
        );

        let generatedZodModule = await readGeneratedFile(
          generatedSchemasFilePath,
        );
        let generatedTypes = await readGeneratedFile(
          generatedSchemaTypesFilePath,
        );

        if (
          (!generatedZodModule || !generatedTypes || shouldRefresh) &&
          validatedBaseUrl
        ) {
          try {
            await generateSchemaArtifacts(
              catalogOptions,
              validatedBaseUrl,
              generatedSchemasFilePath,
              generatedSchemaTypesFilePath,
            );
            generatedZodModule = await readGeneratedFile(
              generatedSchemasFilePath,
            );
            generatedTypes = await readGeneratedFile(
              generatedSchemaTypesFilePath,
            );
            logger.info(
              `WordPress typed schemas written to ${generatedSchemasFilePath} and ${generatedSchemaTypesFilePath}`,
            );
          } catch (error) {
            logger.warn(
              `Failed to generate WordPress typed schema artifacts. Catalog runtime schemas remain available. ${error}`,
            );
          }
        }

        if (generatedZodModule && generatedTypes) {
          state.generatedSchemasPath = generatedSchemasFilePath;
          state.generatedResources = filterGeneratedResources(
            catalogGeneratedResources,
            generatedZodModule,
            generatedTypes,
          );
          addWatchFile(generatedSchemasPath);
          addWatchFile(generatedSchemaTypesPath);
        }

        state.generatedSchemaTypes = generatedTypes;
      },
      'astro:config:done': ({ injectTypes }) => {
        injectTypes({
          filename: 'wp-astrojs-catalog.d.ts',
          content: createVirtualModuleTypes(state),
        });
      },
    },
  };
}
