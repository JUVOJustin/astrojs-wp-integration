import { describe, it, expect, afterAll } from 'vitest';
import { ActionError } from 'astro:actions';
import { z } from 'astro/zod';
import {
  createGetAbilityAction,
  createRunAbilityAction,
  createDeleteAbilityAction,
  executeRunAbility,
} from '../../../src/actions';
import { createBasicAuthHeader } from 'fluent-wp-client';
import { createActionBaseConfig } from '../../helpers/wp-client';
import { callActionOrThrow } from '../../helpers/call-action';

/**
 * Astro action integration for ability wrapper behavior.
 */
describe('Actions: Abilities', () => {
  const optionKey = 'test_action_ability_option';
  const actionBaseConfig = createActionBaseConfig();
  const authHeader = createBasicAuthHeader({
    username: 'admin',
    password: process.env.WP_APP_PASSWORD!,
  });

  const executeConfig = {
    ...actionBaseConfig,
    authHeader,
  };

  afterAll(async () => {
    await executeRunAbility(executeConfig, {
      name: 'test/delete-option',
      input: optionKey,
    }).catch(() => undefined);
  });

  it('supports typed response schema in get ability action', async () => {
    const getAction = createGetAbilityAction({
      baseUrl: actionBaseConfig.baseUrl,
      auth: { username: 'admin', password: process.env.WP_APP_PASSWORD! },
      responseSchema: z.object({
        title: z.string().min(1),
      }),
    });

    const result = await callActionOrThrow(getAction, {
      name: 'test/get-site-title',
    } as never);

    expect(result.title.length).toBeGreaterThan(0);
  });

  it('executes one run ability through the Astro action factory', async () => {
    const runAction = createRunAbilityAction({
      baseUrl: actionBaseConfig.baseUrl,
      auth: { username: 'admin', password: process.env.WP_APP_PASSWORD! },
      responseSchema: z.object({
        current: z.string().min(1),
      }),
    });

    const result = await callActionOrThrow(runAction, {
      name: 'test/update-option',
      input: {
        key: optionKey,
        value: 'astro-action-typed-run',
      },
    } as never);

    expect(result.current).toBe('astro-action-typed-run');
  });

  it('supports typed response schema in delete ability action', async () => {
    await executeRunAbility(executeConfig, {
      name: 'test/update-option',
      input: {
        key: optionKey,
        value: 'astro-action-delete-seed',
      },
    });

    const deleteAction = createDeleteAbilityAction({
      baseUrl: actionBaseConfig.baseUrl,
      auth: { username: 'admin', password: process.env.WP_APP_PASSWORD! },
      responseSchema: z.object({
        deleted: z.boolean(),
      }),
    });

    const result = await callActionOrThrow(deleteAction, {
      name: 'test/delete-option',
      input: optionKey,
    } as never);

    expect(result.deleted).toBe(true);
  });

  it('maps ability auth failures to ActionError', async () => {
    const getAction = createGetAbilityAction({
      baseUrl: actionBaseConfig.baseUrl,
    });

    await expect(
      callActionOrThrow(getAction, { name: 'test/get-site-title' } as never),
    ).rejects.toThrow(ActionError);
  });
});
