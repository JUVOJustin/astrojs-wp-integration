import { describe, it, expect, afterAll } from 'vitest';
import { ActionError } from 'astro/actions/runtime/server.js';
import { executeGetAbility } from '../../../src/actions/ability/get';
import { executeRunAbility } from '../../../src/actions/ability/execute';
import { executeDeleteAbility } from '../../../src/actions/ability/delete';
import { createBasicAuthHeader, createJwtAuthHeader } from '../../../src/client/auth';
import { getBaseUrl } from '../../helpers/wp-client';

/**
 * Integration tests for WordPress Abilities API server actions.
 *
 * Relies on three test abilities registered by the mu-plugin
 * `tests/wp-env/mu-plugins/register-test-abilities.php`:
 *
 * - test/get-site-title   (readonly: true)   → GET  /run
 * - test/update-option    (readonly: false)   → POST /run
 * - test/delete-option    (destructive: true) → DELETE /run
 */
describe('Actions: Abilities', () => {
  const baseUrl = getBaseUrl();
  const apiBase = `${baseUrl}/wp-json/wp/v2`;

  // Authenticated config (basic auth) — admin privileges
  const authConfig = {
    apiBase,
    authHeader: createBasicAuthHeader({
      username: 'admin',
      password: process.env.WP_APP_PASSWORD!,
    }),
  };

  // Authenticated config using JWT token
  const jwtAuthConfig = {
    apiBase,
    authHeader: createJwtAuthHeader(process.env.WP_JWT_TOKEN!),
  };

  // Unauthenticated config — used to verify auth enforcement
  const anonConfig = {
    apiBase,
    authHeader: '',
  };

  // Clean up: reset the test option after all tests
  afterAll(async () => {
    await executeDeleteAbility(authConfig, { name: 'test/delete-option' }).catch(() => {
      // Option may not exist — ignore
    });
  });

  // ---------------------------------------------------------------------------
  // executeGetAbility — GET /run (read-only abilities)
  // ---------------------------------------------------------------------------

  describe('executeGetAbility', () => {
    it('executes a read-only ability and returns the result', async () => {
      const result = await executeGetAbility<{ title: string }>(authConfig, {
        name: 'test/get-site-title',
      });

      expect(result).toBeDefined();
      expect(result.title).toBeDefined();
      expect(typeof result.title).toBe('string');
      expect(result.title.length).toBeGreaterThan(0);
    });

    it('executes a read-only ability with JWT auth', async () => {
      const result = await executeGetAbility<{ title: string }>(jwtAuthConfig, {
        name: 'test/get-site-title',
      });

      expect(result).toBeDefined();
      expect(result.title).toBeDefined();
      expect(typeof result.title).toBe('string');
    });

    it('throws ActionError for a non-existent ability', async () => {
      await expect(
        executeGetAbility(authConfig, { name: 'test/non-existent-ability' }),
      ).rejects.toThrow(ActionError);
    });

    it('throws ActionError when not authenticated', async () => {
      await expect(
        executeGetAbility(anonConfig, { name: 'test/get-site-title' }),
      ).rejects.toThrow(ActionError);
    });
  });

  // ---------------------------------------------------------------------------
  // executeRunAbility — POST /run (regular abilities)
  // ---------------------------------------------------------------------------

  describe('executeRunAbility', () => {
    it('executes a regular ability with input', async () => {
      const result = await executeRunAbility<{ previous: string; current: string }>(
        authConfig,
        {
          name: 'test/update-option',
          input: { value: 'hello-from-test' },
        },
      );

      expect(result).toBeDefined();
      expect(result.current).toBe('hello-from-test');
      expect(typeof result.previous).toBe('string');
    });

    it('returns updated values on subsequent calls', async () => {
      // First call — set a known value
      await executeRunAbility(authConfig, {
        name: 'test/update-option',
        input: { value: 'first-value' },
      });

      // Second call — previous should be the first value
      const result = await executeRunAbility<{ previous: string; current: string }>(
        authConfig,
        {
          name: 'test/update-option',
          input: { value: 'second-value' },
        },
      );

      expect(result.previous).toBe('first-value');
      expect(result.current).toBe('second-value');
    });

    it('executes a regular ability with JWT auth', async () => {
      const result = await executeRunAbility<{ previous: string; current: string }>(
        jwtAuthConfig,
        {
          name: 'test/update-option',
          input: { value: 'jwt-test-value' },
        },
      );

      expect(result).toBeDefined();
      expect(result.current).toBe('jwt-test-value');
    });

    it('throws ActionError for a non-existent ability', async () => {
      await expect(
        executeRunAbility(authConfig, {
          name: 'test/non-existent-ability',
          input: { value: 'should-fail' },
        }),
      ).rejects.toThrow(ActionError);
    });

    it('throws ActionError when not authenticated', async () => {
      await expect(
        executeRunAbility(anonConfig, {
          name: 'test/update-option',
          input: { value: 'should-fail' },
        }),
      ).rejects.toThrow(ActionError);
    });
  });

  // ---------------------------------------------------------------------------
  // executeDeleteAbility — DELETE /run (destructive abilities)
  // ---------------------------------------------------------------------------

  describe('executeDeleteAbility', () => {
    it('executes a destructive ability', async () => {
      // First ensure the option exists
      await executeRunAbility(authConfig, {
        name: 'test/update-option',
        input: { value: 'to-be-deleted' },
      });

      const result = await executeDeleteAbility<{ deleted: boolean; previous: string }>(
        authConfig,
        { name: 'test/delete-option' },
      );

      expect(result).toBeDefined();
      expect(result.deleted).toBe(true);
      expect(result.previous).toBe('to-be-deleted');
    });

    it('executes a destructive ability with JWT auth', async () => {
      // Ensure the option exists
      await executeRunAbility(authConfig, {
        name: 'test/update-option',
        input: { value: 'jwt-delete-test' },
      });

      const result = await executeDeleteAbility<{ deleted: boolean; previous: string }>(
        jwtAuthConfig,
        { name: 'test/delete-option' },
      );

      expect(result).toBeDefined();
      expect(result.deleted).toBe(true);
      expect(result.previous).toBe('jwt-delete-test');
    });

    it('throws ActionError for a non-existent ability', async () => {
      await expect(
        executeDeleteAbility(authConfig, { name: 'test/non-existent-ability' }),
      ).rejects.toThrow(ActionError);
    });

    it('throws ActionError when not authenticated', async () => {
      await expect(
        executeDeleteAbility(anonConfig, { name: 'test/delete-option' }),
      ).rejects.toThrow(ActionError);
    });
  });
});
