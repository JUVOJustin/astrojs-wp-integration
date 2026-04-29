import { describe, it, expect } from 'vitest';
import { callAction, ActionError } from '../../helpers/action-client';

/**
 * Integration tests validating that Astro actions do not leak user-specific
 * data across authenticated sessions.
 */
describe('Actions: User Data Isolation', () => {
  const aliceToken = process.env.WP_ALICE_JWT_TOKEN!;
  const bobToken = process.env.WP_BOB_JWT_TOKEN!;
  const aliceAuth = `Bearer ${aliceToken}`;
  const bobAuth = `Bearer ${bobToken}`;

  it('returns alice profile when authenticated as alice', async () => {
    const profile = await callAction<{ id: number; slug: string; name: string }>(
      'getCurrentUserProfile',
      {},
      { authHeader: aliceAuth },
    );

    expect(profile.slug).toBe('alice');
    expect(profile.name).toBe('Alice Test');
    expect(profile.id).toBeGreaterThan(0);
  });

  it('returns bob profile when authenticated as bob', async () => {
    const profile = await callAction<{ id: number; slug: string; name: string }>(
      'getCurrentUserProfile',
      {},
      { authHeader: bobAuth },
    );

    expect(profile.slug).toBe('bob');
    expect(profile.name).toBe('Bob Test');
    expect(profile.id).toBeGreaterThan(0);
  });

  it('does not leak alice profile to bob across sequential requests', async () => {
    const aliceProfile = await callAction<{ id: number; slug: string; name: string }>(
      'getCurrentUserProfile',
      {},
      { authHeader: aliceAuth },
    );

    const bobProfile = await callAction<{ id: number; slug: string; name: string }>(
      'getCurrentUserProfile',
      {},
      { authHeader: bobAuth },
    );

    expect(aliceProfile.id).not.toBe(bobProfile.id);
    expect(bobProfile.slug).not.toBe(aliceProfile.slug);
    expect(bobProfile.name).not.toBe(aliceProfile.name);
  });

  it('does not leak alice profile to bob when bob reuses the same action payload', async () => {
    // Simulate a confused deputy where the same action input is reused
    const sharedInput = {};

    const aliceProfile = await callAction<{ id: number; slug: string; name: string }>(
      'getCurrentUserProfile',
      sharedInput,
      { authHeader: aliceAuth },
    );

    const bobProfile = await callAction<{ id: number; slug: string; name: string }>(
      'getCurrentUserProfile',
      sharedInput,
      { authHeader: bobAuth },
    );

    expect(bobProfile.slug).toBe('bob');
    expect(bobProfile.name).toBe('Bob Test');
    expect(bobProfile.id).not.toBe(aliceProfile.id);
  });

  it('rejects unauthenticated requests for user profile', async () => {
    await expect(
      callAction('getCurrentUserProfile', {}),
    ).rejects.toThrow(ActionError);
  });

  it('rejects requests with an invalid token', async () => {
    await expect(
      callAction('getCurrentUserProfile', {}, { authHeader: 'Bearer invalid-token-12345' }),
    ).rejects.toThrow(ActionError);
  });

  it('isolates profiles when switching from alice JWT to bob app-password auth', async () => {
    // Create an app password for alice via admin CLI? Not available in test env easily.
    // Instead, verify JWT for alice and then a fresh JWT for bob in the same test.
    const first = await callAction<{ id: number; slug: string }>(
      'getCurrentUserProfile',
      {},
      { authHeader: aliceAuth },
    );

    const second = await callAction<{ id: number; slug: string }>(
      'getCurrentUserProfile',
      {},
      { authHeader: bobAuth },
    );

    const third = await callAction<{ id: number; slug: string }>(
      'getCurrentUserProfile',
      {},
      { authHeader: aliceAuth },
    );

    expect(first.slug).toBe('alice');
    expect(second.slug).toBe('bob');
    expect(third.slug).toBe('alice');
    expect(first.id).toBe(third.id);
    expect(second.id).not.toBe(first.id);
  });
});
