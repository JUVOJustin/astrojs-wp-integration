import type { WordPressBlockParser, WordPressParsedBlock } from 'fluent-wp-client';

/**
 * Loader-level configuration for Gutenberg block parsing.
 */
export interface WordPressLoaderBlocksConfig {
  /** Optional parser override used instead of the default parser. */
  parser?: WordPressBlockParser;
}

/**
 * Opt-in switch for enabling Gutenberg block parsing in loaders.
 */
export type WordPressLoaderBlocksOption = boolean | WordPressLoaderBlocksConfig;

/**
 * Props passed to one mapped Astro Gutenberg block component.
 */
export interface WordPressBlockComponentProps {
  block: WordPressParsedBlock;
  attrs: Record<string, unknown> | null;
  innerBlocks: WordPressParsedBlock[];
  index: number;
}

/**
 * Registry entry for one block component mapping.
 */
export interface WordPressBlockRegistryEntry {
  component: unknown;
}

/**
 * Registry shape accepted by the Gutenberg Astro renderer.
 */
export type WordPressBlockRegistry = Record<string, unknown | WordPressBlockRegistryEntry>;
