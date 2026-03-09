# Abilities

This guide covers WordPress abilities in the Astro integration.

WordPress abilities are executable server-side primitives exposed through `/wp-json/wp-abilities/v1`.

The Astro package does not implement a parallel ability system. It resolves auth for the current request, delegates to `fluent-wp-client`, and lets WordPress enforce the registered ability rules.

## How abilities work in Astro

- `createGetAbilityAction` wraps read-only abilities executed with `GET /run`
- `createRunAbilityAction` wraps regular abilities executed with `POST /run`
- `createDeleteAbilityAction` wraps destructive abilities executed with `DELETE /run`
- Astro maps client and WordPress failures into `ActionError`

## Recommended pattern

1. Resolve auth per request with the auth bridge or action auth helpers
2. Call the matching ability action
3. Branch on `error.code` when WordPress rejects the request

```ts
const { data, error } = await Astro.callAction(actions.runAbility, {
  name: 'my-plugin/update-option',
  input: { value: 'hello' },
});

if (error?.code === 'FORBIDDEN') {
  // Authenticated user is not allowed to run this ability
}
```

## Client relationship

Astro ability actions are thin wrappers around the published client.

If you want to inspect ability metadata or execute abilities outside Astro, use `fluent-wp-client` directly.

The local Astro integration suite for abilities runs from this repository's root `wp-env` setup.

## Related docs

- Action overview: `docs/actions/index.mdx`
- Ability actions: `docs/actions/abilities.mdx`
- Auth bridge: `docs/auth-action-bridge.md`
- Published client abilities: https://github.com/JUVOJustin/fluent-wp-client/blob/main/docs/abilities.md
