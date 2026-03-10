import { parseWordPressBlocks } from 'fluent-wp-client';
import type { WordPressClient, WordPressParsedBlock } from 'fluent-wp-client';
import type { WordPressLoaderBlocksConfig, WordPressLoaderBlocksOption } from '../blocks';
import type { WordPressLoaderConfig } from './types';

/**
 * Expands one block option value into a normalized config object.
 */
export function resolveLoaderBlocksConfig(
  blocks: WordPressLoaderBlocksOption | undefined,
): WordPressLoaderBlocksConfig | null {
  if (!blocks) {
    return null;
  }

  if (blocks === true) {
    return {};
  }

  return blocks;
}

/**
 * Ensures block parsing is configured with credentials that can request edit context.
 */
export function assertLoaderBlockAuth(
  config: WordPressLoaderConfig,
  loaderName: string,
): void {
  if (config.auth || config.authHeader || config.authHeaders) {
    return;
  }

  throw new Error(`${loaderName} requires authentication when blocks are enabled. Provide auth, authHeader, or authHeaders so the loader can request context=edit raw content.`);
}

/**
 * Loads and parses Gutenberg blocks from one post-like resource item.
 */
export async function loadResourceBlocks(
  client: WordPressClient,
  resource: string,
  id: number,
  options: WordPressLoaderBlocksConfig,
): Promise<WordPressParsedBlock[]> {
  const { data } = await client.request<unknown>({
    endpoint: `/${resource}/${id}`,
    method: 'GET',
    params: {
      context: 'edit',
      _embed: 'true',
    },
  });

  if (!data || typeof data !== 'object' || !('content' in data)) {
    throw new Error(`Invalid content response for ${resource} id ${id}.`);
  }

  const content = (data as { content?: unknown }).content;

  if (!content || typeof content !== 'object') {
    throw new Error(`Missing content field for ${resource} id ${id}.`);
  }

  const raw = (content as { raw?: unknown }).raw;

  if (typeof raw !== 'string') {
    throw new Error(`Raw content is unavailable for ${resource} id ${id}. The configured credentials may not have edit capabilities.`);
  }

  return parseWordPressBlocks(raw, options.parser);
}
