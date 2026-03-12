import { describe, it, expect, afterAll } from 'vitest';
import { callAction, ActionError } from '../../helpers/action-client';

/**
 * Astro action integration for ability wrapper behavior.
 */
describe('Actions: Abilities', () => {
  const optionKey = 'test_action_ability_option';
  const basicAuth = `Basic ${btoa(`admin:${process.env.WP_APP_PASSWORD!}`)}`;

  afterAll(async () => {
    await callAction('deleteAbility', {
      name: 'test/delete-option',
      input: optionKey,
    }, { authHeader: basicAuth }).catch(() => undefined);
  });

  it('supports typed response schema in get ability action', async () => {
    const result = await callAction<{ title: string }>('getAbility', {
      name: 'test/get-site-title',
    }, { authHeader: basicAuth });

    expect(result.title.length).toBeGreaterThan(0);
  });

  it('executes one run ability through the Astro action factory', async () => {
    const result = await callAction<{ current: string }>('runAbility', {
      name: 'test/update-option',
      input: { key: optionKey, value: 'astro-action-typed-run' },
    }, { authHeader: basicAuth });

    expect(result.current).toBe('astro-action-typed-run');
  });

  it('supports typed response schema in delete ability action', async () => {
    await callAction('runAbility', {
      name: 'test/update-option',
      input: { key: optionKey, value: 'astro-action-delete-seed' },
    }, { authHeader: basicAuth });

    const result = await callAction<{ deleted: boolean }>('deleteAbility', {
      name: 'test/delete-option',
      input: optionKey,
    }, { authHeader: basicAuth });

    expect(result.deleted).toBe(true);
  });

  it('maps ability auth failures to ActionError', async () => {
    await expect(
      callAction('getAbility', { name: 'test/get-site-title' }),
    ).rejects.toThrow(ActionError);
  });
});
