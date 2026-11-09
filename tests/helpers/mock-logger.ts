import { vi } from 'vitest';

/**
 * Mimics the AstroIntegrationLogger interface used by static loaders
 */
export function createMockLogger() {
  return {
    debug: vi.fn(),
    error: vi.fn(),
    fork: vi.fn(),
    info: vi.fn(),
    label: 'test',
    warn: vi.fn(),
  };
}
