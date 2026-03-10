import type { WordPressBlockRegistry, WordPressBlockRegistryEntry } from './types';

/**
 * Resolves one component value from a registry entry.
 */
function extractRegistryComponent(entry: unknown): unknown {
  if (!entry || typeof entry !== 'object' || !('component' in entry)) {
    return entry;
  }

  return (entry as WordPressBlockRegistryEntry).component;
}

/**
 * Returns fallback lookup keys for one full WordPress block name.
 */
function createLookupKeys(blockName: string): string[] {
  const slashIndex = blockName.indexOf('/');

  if (slashIndex === -1) {
    return [blockName];
  }

  const shortName = blockName.slice(slashIndex + 1);
  return [blockName, shortName];
}

/**
 * Marks a block registry object for type-safe usage.
 */
export function defineWordPressBlockRegistry<TRegistry extends WordPressBlockRegistry>(
  registry: TRegistry,
): TRegistry {
  return registry;
}

/**
 * Resolves one block component by trying both full and short block keys.
 */
export function resolveWordPressBlockComponent(
  registry: WordPressBlockRegistry | undefined,
  blockName: string | null,
): unknown {
  if (!registry || !blockName) {
    return undefined;
  }

  for (const key of createLookupKeys(blockName)) {
    if (!(key in registry)) {
      continue;
    }

    return extractRegistryComponent(registry[key]);
  }

  return undefined;
}
