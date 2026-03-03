import { vi } from 'vitest';

/**
 * Mimics the Astro DataStore interface used by static loaders
 * Stores entries in a Map for assertion in tests
 */
export function createMockStore() {
  const entries = new Map<string, { data: unknown; rendered?: { html: string } }>();

  const store = {
    clear: vi.fn(() => entries.clear()),
    set: vi.fn(({ id, data, rendered }: { id: string; data: unknown; rendered?: { html: string } }) => {
      entries.set(id, { data, rendered });
    }),
  };

  return { store, entries };
}
