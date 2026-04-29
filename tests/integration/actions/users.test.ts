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
  password: string,
): Promise<string> {
  const response = await fetch(`${baseUrl}/wp-json/jwt-auth/v1/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const payload = (await response.json().catch(() => null)) as {
    token?: unknown;
  } | null;
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
  const basicAuth = `Basic ${btoa(`admin:${process.env.WP_APP_PASSWORD!}`)}`;
  const createdIds: number[] = [];

  afterAll(async () => {
    for (const id of createdIds) {
      await callAction(
        'deleteUser',
        { id, force: true, reassign: 1 },
        { authHeader: basicAuth },
      ).catch(() => undefined);
    }
  });

  it('creates users through action factory with schema extensions', async () => {
    const suffix = createUniqueUserSuffix();
    const created = await callAction<{ id: number; slug: string }>(
      'createUserCustomSchema',
      {
        username: `user-create-${suffix}`,
        email: `user-create-${suffix}@example.com`,
        password: 'integration-password',
        name: 'Users behavior: action create',
        roles: ['author'],
        app_source: 'integration-test',
      },
      { authHeader: basicAuth },
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
        username: `user-update-${suffix}`,
        email: `user-update-${suffix}@example.com`,
        password: 'integration-password',
        name: 'Users behavior: update base',
        roles: ['author'],
      },
      { authHeader: basicAuth },
    );
    createdIds.push(created.id);

    const updated = await callAction<{ id: number; name: string }>(
      'updateUserCustomSchema',
      {
        id: created.id,
        name: 'Users behavior: updated',
        description: 'Updated through Astro action integration test',
        app_updated_by: 'integration-test',
      },
      { authHeader: basicAuth },
    );

    expect(updated.id).toBe(created.id);
    expect(updated.name).toBe('Users behavior: updated');
  });

  it('supports response schema override for create user action', async () => {
    const suffix = createUniqueUserSuffix();
    const created = await callAction<{ id: number; slug: string }>(
      'createUserResponseOverride',
      {
        username: `user-schema-${suffix}`,
        email: `user-schema-${suffix}@example.com`,
        password: 'integration-password',
      },
      { authHeader: basicAuth },
    );

    createdIds.push(created.id);
    expect(created.slug).toContain(`user-schema-${suffix}`);
  });

  it('maps unauthenticated create-user execution to ActionError', async () => {
    await expect(
      callAction('createUser', {
        username: `user-anon-${createUniqueUserSuffix()}`,
        email: `user-anon-${createUniqueUserSuffix()}@example.com`,
        password: 'integration-password',
      }),
    ).rejects.toMatchObject({ type: 'AstroActionError' });
  });

  it('requires reassign and supports force delete behavior for users', async () => {
    const suffix = createUniqueUserSuffix();
    const candidate = await callAction<{ id: number }>(
      'createUser',
      {
        username: `user-delete-${suffix}`,
        email: `user-delete-${suffix}@example.com`,
        password: 'integration-password',
      },
      { authHeader: basicAuth },
    );

    await expect(
      callAction('deleteUser', { id: candidate.id }, { authHeader: basicAuth }),
    ).rejects.toThrow();

    const deleted = await callAction<{
      id: number;
      deleted: boolean;
      reassignedTo: number;
    }>(
      'deleteUser',
      {
        id: candidate.id,
        reassign: 1,
        force: true,
      },
      { authHeader: basicAuth },
    );

    expect(deleted.id).toBe(candidate.id);
    expect(deleted.deleted).toBe(true);
    expect(deleted.reassignedTo).toBe(1);
  });

  it('blocks users from updating other accounts while allowing self profile updates', async () => {
    const suffix = createUniqueUserSuffix();
    const username = `user-perm-${suffix}`;
    const password = 'integration-password';

    const authorUser = await callAction<{ id: number }>(
      'createUser',
      {
        username,
        email: `${username}@example.com`,
        password,
        name: 'Users behavior: permissions baseline',
        roles: ['author'],
      },
      { authHeader: basicAuth },
    );
    createdIds.push(authorUser.id);

    const userJwtToken = await createJwtTokenForUser(
      actionBaseConfig.baseUrl,
      username,
      password,
    );
    const userAuth = `Bearer ${userJwtToken}`;

    await expect(
      callAction(
        'updateUser',
        {
          id: 1,
          name: 'Users behavior: forbidden cross-account update',
        },
        { authHeader: userAuth },
      ),
    ).rejects.toThrow(ActionError);

    const updatedSelf = await callAction<{ id: number; name: string }>(
      'updateUser',
      {
        id: authorUser.id,
        name: 'Users behavior: self update success',
        description: 'Updated by the same author user',
      },
      { authHeader: userAuth },
    );

    expect(updatedSelf.id).toBe(authorUser.id);
    expect(updatedSelf.name).toBe('Users behavior: self update success');
  });
});
