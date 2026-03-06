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
 * Relies on five test abilities registered by the mu-plugin
 * `tests/wp-env/mu-plugins/register-test-abilities.php`:
 *
 * - test/get-site-title    (readonly: true)   → GET  /run  (simple schema)
 * - test/get-complex-data  (readonly: true)   → GET  /run  (complex nested input/output)
 * - test/update-option     (readonly: false)  → POST /run  (simple schema)
 * - test/process-complex   (readonly: false)  → POST /run  (complex nested input/output)
 * - test/delete-option     (destructive: true) → DELETE /run
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

    it('executes a read-only ability with complex input and nested output', async () => {
      const result = await executeGetAbility<{
        user: { id: number; name: string; roles: string[] };
        site: { title: string; url: string };
        meta_included: boolean;
      }>(authConfig, {
        name: 'test/get-complex-data',
        input: { user_id: 1, include_meta: true },
      });

      expect(result).toBeDefined();
      // Nested user object
      expect(result.user).toBeDefined();
      expect(result.user.id).toBe(1);
      expect(typeof result.user.name).toBe('string');
      expect(result.user.name.length).toBeGreaterThan(0);
      expect(Array.isArray(result.user.roles)).toBe(true);
      expect(result.user.roles.length).toBeGreaterThan(0);
      // Nested site object
      expect(result.site).toBeDefined();
      expect(typeof result.site.title).toBe('string');
      expect(typeof result.site.url).toBe('string');
      // Boolean flag
      expect(result.meta_included).toBe(true);
    });

    it('handles complex input with optional fields omitted', async () => {
      const result = await executeGetAbility<{
        user: { id: number; name: string; roles: string[] };
        site: { title: string; url: string };
        meta_included: boolean;
      }>(authConfig, {
        name: 'test/get-complex-data',
        input: { user_id: 1 },
      });

      expect(result.user.id).toBe(1);
      expect(result.meta_included).toBe(false);
    });

    it('validates complex response with a responseSchema', async () => {
      const { z } = await import('astro/zod');
      const complexResponseSchema = z.object({
        user: z.object({
          id: z.number(),
          name: z.string(),
          roles: z.array(z.string()),
        }),
        site: z.object({
          title: z.string(),
          url: z.string(),
        }),
        meta_included: z.boolean(),
      });

      const result = await executeGetAbility(
        { ...authConfig, responseSchema: complexResponseSchema },
        { name: 'test/get-complex-data', input: { user_id: 1, include_meta: false } },
      );

      expect(result.user.id).toBe(1);
      expect(result.meta_included).toBe(false);
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

    it('throws ActionError when required input field is missing', async () => {
      await expect(
        executeRunAbility(authConfig, {
          name: 'test/update-option',
          input: {},
        }),
      ).rejects.toThrow(ActionError);
    });

    it('throws ActionError when input has wrong property name', async () => {
      await expect(
        executeRunAbility(authConfig, {
          name: 'test/update-option',
          input: { wrong_field: 'some-value' },
        }),
      ).rejects.toThrow(ActionError);
    });

    it('throws ActionError when input has wrong type', async () => {
      await expect(
        executeRunAbility(authConfig, {
          name: 'test/update-option',
          input: { value: 12345 },
        }),
      ).rejects.toThrow(ActionError);
    });

    it('executes a complex ability with nested object and array input', async () => {
      const result = await executeRunAbility<{
        processed: boolean;
        echo: {
          name: string;
          settings: { theme: string; font_size: number };
          tags: string[];
        };
      }>(authConfig, {
        name: 'test/process-complex',
        input: {
          name: 'test-config',
          settings: { theme: 'dark', font_size: 16 },
          tags: ['alpha', 'beta', 'gamma'],
        },
      });

      expect(result).toBeDefined();
      expect(result.processed).toBe(true);
      // Echoed nested object
      expect(result.echo.name).toBe('test-config');
      expect(result.echo.settings.theme).toBe('dark');
      expect(result.echo.settings.font_size).toBe(16);
      // Echoed array
      expect(result.echo.tags).toEqual(['alpha', 'beta', 'gamma']);
    });

    it('handles complex input with optional array omitted', async () => {
      const result = await executeRunAbility<{
        processed: boolean;
        echo: {
          name: string;
          settings: { theme: string; font_size?: number };
          tags: string[];
        };
      }>(authConfig, {
        name: 'test/process-complex',
        input: {
          name: 'minimal-config',
          settings: { theme: 'light' },
        },
      });

      expect(result.processed).toBe(true);
      expect(result.echo.name).toBe('minimal-config');
      expect(result.echo.settings.theme).toBe('light');
      expect(result.echo.tags).toEqual([]);
    });

    it('throws ActionError when complex input is missing required nested field', async () => {
      await expect(
        executeRunAbility(authConfig, {
          name: 'test/process-complex',
          input: {
            name: 'missing-settings',
            // 'settings' is required but missing
          },
        }),
      ).rejects.toThrow(ActionError);
    });

    it('throws ActionError when complex input has wrong nested type', async () => {
      await expect(
        executeRunAbility(authConfig, {
          name: 'test/process-complex',
          input: {
            name: 'wrong-type',
            settings: 'not-an-object',
          },
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
