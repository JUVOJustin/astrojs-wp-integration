import { describe, it, expect, afterAll } from 'vitest';
import { ActionError } from 'astro/actions/runtime/server.js';
import { z } from 'astro/zod';
import {
  createCreateUserAction,
  createUpdateUserAction,
  createDeleteUserAction,
  createUserInputSchema,
  updateUserInputSchema,
  executeDeleteUser,
  executeCreateUser,
} from '../../../src/actions';
import { createBasicAuthHeader } from 'fluent-wp-client';
import { createActionBaseConfig } from '../../helpers/wp-client';
import { callActionOrThrow } from '../../helpers/call-action';

/**
 * Creates one unique user payload suffix to avoid username/email collisions.
 */
function createUniqueUserSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Requests one JWT token for a test user.
 */
async function createJwtTokenForUser(baseUrl: string, username: string, password: string): Promise<string> {
  const response = await fetch(`${baseUrl}/wp-json/jwt-auth/v1/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  });

  const payload = await response.json().catch(() => null) as { token?: unknown } | null;

  if (!response.ok || !payload || typeof payload.token !== 'string') {
    throw new Error('Failed to create JWT token for integration test user.');
  }

  return payload.token;
}

/**
 * Astro action integration for WordPress user create/update/delete behavior.
 */
describe('Actions: Users', () => {
  const actionBaseConfig = createActionBaseConfig();
  const authHeader = createBasicAuthHeader({
    username: 'admin',
    password: process.env.WP_APP_PASSWORD!,
  });

  const userConfig = {
    ...actionBaseConfig,
    authHeader,
  };

  const createdIds: number[] = [];

  afterAll(async () => {
    for (const id of createdIds) {
      await executeDeleteUser(userConfig, {
        id,
        force: true,
        reassign: 1,
      }).catch(() => undefined);
    }
  });

  it('creates users through action factory with schema extensions', async () => {
    const createUserAction = createCreateUserAction({
      baseUrl: actionBaseConfig.baseUrl,
      auth: { username: 'admin', password: process.env.WP_APP_PASSWORD! },
      schema: createUserInputSchema.extend({
        app_source: z.string().optional(),
      }),
    });

    const suffix = createUniqueUserSuffix();
    const created = await callActionOrThrow(createUserAction, {
      username: `user-create-${suffix}`,
      email: `user-create-${suffix}@example.com`,
      password: 'integration-password',
      name: 'Users behavior: action create',
      roles: ['author'],
      app_source: 'integration-test',
    } as never);

    createdIds.push(created.id);
    expect(created.id).toBeGreaterThan(0);
    expect(created.slug).toContain(`user-create-${suffix}`);
  });

  it('updates users through action factory with schema extensions', async () => {
    const suffix = createUniqueUserSuffix();
    const created = await executeCreateUser(userConfig, {
      username: `user-update-${suffix}`,
      email: `user-update-${suffix}@example.com`,
      password: 'integration-password',
      name: 'Users behavior: update base',
      roles: ['author'],
    });
    createdIds.push(created.id);

    const updateUserAction = createUpdateUserAction({
      baseUrl: actionBaseConfig.baseUrl,
      auth: { username: 'admin', password: process.env.WP_APP_PASSWORD! },
      schema: updateUserInputSchema.extend({
        app_updated_by: z.string().optional(),
      }),
    });

    const updated = await callActionOrThrow(updateUserAction, {
      id: created.id,
      name: 'Users behavior: updated',
      description: 'Updated through Astro action integration test',
      app_updated_by: 'integration-test',
    } as never);

    expect(updated.id).toBe(created.id);
    expect(updated.name).toBe('Users behavior: updated');
  });

  it('supports response schema override for create user action', async () => {
    const createUserAction = createCreateUserAction({
      baseUrl: actionBaseConfig.baseUrl,
      auth: { username: 'admin', password: process.env.WP_APP_PASSWORD! },
      responseSchema: z.object({
        id: z.number().int().positive(),
        slug: z.string(),
      }),
    });

    const suffix = createUniqueUserSuffix();
    const created = await callActionOrThrow(createUserAction, {
      username: `user-schema-${suffix}`,
      email: `user-schema-${suffix}@example.com`,
      password: 'integration-password',
    } as never);

    createdIds.push(created.id);
    expect(created.slug).toContain(`user-schema-${suffix}`);
  });

  it('maps unauthenticated create-user execution to ActionError', async () => {
    await expect(
      executeCreateUser(
        {
          ...actionBaseConfig,
          authHeader: '',
        },
        {
          username: `user-anon-${createUniqueUserSuffix()}`,
          email: `user-anon-${createUniqueUserSuffix()}@example.com`,
          password: 'integration-password',
        },
      ),
    ).rejects.toThrow(ActionError);
  });

  it('requires reassign and supports force delete behavior for users', async () => {
    const createUserAction = createCreateUserAction({
      baseUrl: actionBaseConfig.baseUrl,
      auth: { username: 'admin', password: process.env.WP_APP_PASSWORD! },
    });

    const deleteUserAction = createDeleteUserAction({
      baseUrl: actionBaseConfig.baseUrl,
      auth: { username: 'admin', password: process.env.WP_APP_PASSWORD! },
    });

    const suffix = createUniqueUserSuffix();
    const candidate = await callActionOrThrow(createUserAction, {
      username: `user-delete-${suffix}`,
      email: `user-delete-${suffix}@example.com`,
      password: 'integration-password',
    } as never);

    await expect(
      callActionOrThrow(deleteUserAction, {
        id: candidate.id,
      } as never),
    ).rejects.toThrow();

    const deleted = await callActionOrThrow(deleteUserAction, {
      id: candidate.id,
      reassign: 1,
      force: true,
    } as never);

    expect(deleted.id).toBe(candidate.id);
    expect(deleted.deleted).toBe(true);
    expect(deleted.reassignedTo).toBe(1);
  });

  it('blocks users from updating other accounts while allowing self profile updates', async () => {
    const suffix = createUniqueUserSuffix();
    const username = `user-perm-${suffix}`;
    const password = 'integration-password';

    const authorUser = await executeCreateUser(userConfig, {
      username,
      email: `${username}@example.com`,
      password,
      name: 'Users behavior: permissions baseline',
      roles: ['author'],
    });
    createdIds.push(authorUser.id);

    const userJwtToken = await createJwtTokenForUser(actionBaseConfig.baseUrl, username, password);
    const updateAsAuthor = createUpdateUserAction({
      baseUrl: actionBaseConfig.baseUrl,
      auth: { token: userJwtToken },
    });

    await expect(
      callActionOrThrow(updateAsAuthor, {
        id: 1,
        name: 'Users behavior: forbidden cross-account update',
      } as never),
    ).rejects.toThrow(ActionError);

    const updatedSelf = await callActionOrThrow(updateAsAuthor, {
      id: authorUser.id,
      name: 'Users behavior: self update success',
      description: 'Updated by the same author user',
    } as never);

    expect(updatedSelf.id).toBe(authorUser.id);
    expect(updatedSelf.name).toBe('Users behavior: self update success');
  });
});
