import { vi } from 'vitest';

/**
 * Mimics the AstroIntegrationLogger interface used by static loaders
 */
export function createMockLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    label: 'test',
    fork: vi.fn(),
  };
}
