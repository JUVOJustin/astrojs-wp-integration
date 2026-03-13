# Testing

This package uses integration-first testing against a real local WordPress instance.

## Test Projects

- `integration`: Loader runtime, action RPC, auth bridge, meta, ACF, and ability coverage through the shared Astro dev fixture.
- `static-build`: Real `astro build` validation for static loader content collections.

## Local Workflow

Start local WordPress first:

```bash
npm run wp:start
```

Run tests:

```bash
npm run test:integration
npm run test:build
# or run both projects
npm test
```

Stop or reset local WordPress:

```bash
npm run wp:stop
npm run wp:clean
```

## Auth Bridge Coverage

Auth bridge behavior is covered by the `integration` project against `wp-env`.

- Action integration tests call real `/_actions/*` endpoints from the shared fixture in `tests/fixtures/astro-site/`.
- `tests/setup/global-setup.ts` provisions auth fixtures (application password, JWT, cookie+nonce) before integration suites run.
