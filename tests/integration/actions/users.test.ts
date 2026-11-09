import { afterAll, describe, expect, it } from 'vitest';

import { ActionError, callAction } from '../../helpers/action-client';
import { createActionBaseConfig } from '../../helpers/wp-client';

/**
 * Creates one unique user payload suffix to avoid username/email collisions.
 */
function createUniqueUserSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Requests one JWT token for a test user.
 */
async function createJwtTokenForUser(
  baseUrl: string,
  username: string,
  password: string
): Promise<string> {
  const response = await fetch(`${baseUrl}/wp-json/jwt-auth/v1/token`, {
    body: JSON.stringify({ password, username }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });

  const payload: unknown = await response.json().catch(() => null);

  if (
    !response.ok ||
    // oxlint-disable-next-line anti-slop/no-runtime-typeof -- JWT failures may return primitive or null bodies instead of a token object.
    typeof payload !== 'object' ||
    payload === null ||
    !('token' in payload) ||
    // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Only a token string can authenticate subsequent fixture requests.
    typeof payload.token !== 'string'
  ) {
    throw new Error('Failed to create JWT token for integration test user.');
  }

  return payload.token;
}

/**
 * Astro action integration for WordPress user create/update/delete behavior.
 */
describe('Actions: Users', () => {
  const actionBaseConfig = createActionBaseConfig();
  const basicAuth = `Basic ${btoa(`admin:${process.env.WP_APP_PASSWORD!}`)}`;
  const createdIds: number[] = [];

  afterAll(async () => {
    for (const id of createdIds) {
      await callAction(
        'deleteUser',
        { force: true, id, reassign: 1 },
        { authHeader: basicAuth }
      ).catch(() => {});
    }
  });

  it('creates users through action factory with schema extensions', async () => {
    const suffix = createUniqueUserSuffix();

    const created = await callAction<{ id: number; slug: string }>(
      'createUserCustomSchema',
      {
        app_source: 'integration-test',
        email: `user-create-${suffix}@example.com`,
        name: 'Users behavior: action create',
        password: 'integration-password',
        roles: ['author'],
        username: `user-create-${suffix}`,
      },
      { authHeader: basicAuth }
    );

    createdIds.push(created.id);
    expect(created.id).toBeGreaterThan(0);
    expect(created.slug).toContain(`user-create-${suffix}`);
  });

  it('updates users through action factory with schema extensions', async () => {
    const suffix = createUniqueUserSuffix();

    const created = await callAction<{ id: number }>(
      'createUser',
      {
        email: `user-update-${suffix}@example.com`,
        name: 'Users behavior: update base',
        password: 'integration-password',
        roles: ['author'],
        username: `user-update-${suffix}`,
      },
      { authHeader: basicAuth }
    );

    createdIds.push(created.id);

    const updated = await callAction<{ id: number; name: string }>(
      'updateUserCustomSchema',
      {
        app_updated_by: 'integration-test',
        description: 'Updated through Astro action integration test',
        id: created.id,
        name: 'Users behavior: updated',
      },
      { authHeader: basicAuth }
    );

    expect(updated.id).toBe(created.id);
    expect(updated.name).toBe('Users behavior: updated');
  });

  it('supports response schema override for create user action', async () => {
    const suffix = createUniqueUserSuffix();

    const created = await callAction<{ id: number; slug: string }>(
      'createUserResponseOverride',
      {
        email: `user-schema-${suffix}@example.com`,
        password: 'integration-password',
        username: `user-schema-${suffix}`,
      },
      { authHeader: basicAuth }
    );

    createdIds.push(created.id);
    expect(created.slug).toContain(`user-schema-${suffix}`);
  });

  it('maps unauthenticated create-user execution to ActionError', async () => {
    await expect(
      callAction('createUser', {
        email: `user-anon-${createUniqueUserSuffix()}@example.com`,
        password: 'integration-password',
        username: `user-anon-${createUniqueUserSuffix()}`,
      })
    ).rejects.toMatchObject({ type: 'AstroActionError' });
  });

  it('requires reassign and supports force delete behavior for users', async () => {
    const suffix = createUniqueUserSuffix();

    const candidate = await callAction<{ id: number }>(
      'createUser',
      {
        email: `user-delete-${suffix}@example.com`,
        password: 'integration-password',
        username: `user-delete-${suffix}`,
      },
      { authHeader: basicAuth }
    );

    await expect(
      callAction('deleteUser', { id: candidate.id }, { authHeader: basicAuth })
    ).rejects.toThrow();

    const deleted = await callAction<{
      id: number;
      deleted: boolean;
      reassignedTo: number;
    }>(
      'deleteUser',
      {
        force: true,
        id: candidate.id,
        reassign: 1,
      },
      { authHeader: basicAuth }
    );

    expect(deleted.id).toBe(candidate.id);
    expect(deleted.deleted).toBeTruthy();
    expect(deleted.reassignedTo).toBe(1);
  });

  it('blocks users from updating other accounts while allowing self profile updates', async () => {
    const suffix = createUniqueUserSuffix();
    const username = `user-perm-${suffix}`;
    const password = 'integration-password';

    const authorUser = await callAction<{ id: number }>(
      'createUser',
      {
        email: `${username}@example.com`,
        name: 'Users behavior: permissions baseline',
        password,
        roles: ['author'],
        username,
      },
      { authHeader: basicAuth }
    );

    createdIds.push(authorUser.id);

    const userJwtToken = await createJwtTokenForUser(
      actionBaseConfig.baseUrl,
      username,
      password
    );

    const userAuth = `Bearer ${userJwtToken}`;

    await expect(
      callAction(
        'updateUser',
        {
          id: 1,
          name: 'Users behavior: forbidden cross-account update',
        },
        { authHeader: userAuth }
      )
    ).rejects.toThrow(ActionError);

    const updatedSelf = await callAction<{ id: number; name: string }>(
      'updateUser',
      {
        description: 'Updated by the same author user',
        id: authorUser.id,
        name: 'Users behavior: self update success',
      },
      { authHeader: userAuth }
    );

    expect(updatedSelf.id).toBe(authorUser.id);
    expect(updatedSelf.name).toBe('Users behavior: self update success');
  });
});
