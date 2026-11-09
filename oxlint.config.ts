import { defineConfig } from 'oxlint';
import antiSlop from 'ultracite/oxlint/anti-slop';
import astro from 'ultracite/oxlint/astro';
import core from 'ultracite/oxlint/core';
import vitestPreset from 'ultracite/oxlint/vitest';

import { qualityIgnore } from './quality-ignore.ts';

const vitest = {
  ...vitestPreset,
  overrides: vitestPreset.overrides.map((override) => ({
    ...override,
    rules: {
      ...override.rules,
      // Full-stack scenarios assert several related response and cache properties.
      'vitest/max-expects': 'off',
      'vitest/prefer-to-be-truthy': 'off',
      'vitest/prefer-to-be-falsy': 'off',
      'vitest/no-conditional-expect': 'off',
      'vitest/expect-expect': 'off',
      'vitest/require-to-throw-message': 'off',
    },
  })),
};

export default defineConfig({
  overrides: [
    {
      files: ['tests/**/*.ts'],
      // Setup establishes required fixture values before the tests run.
      rules: { 'typescript/no-non-null-assertion': 'off' },
    },
    {
      files: [
        'src/actions/**/*.ts',
        'src/loaders/*.ts',
        'src/server/auth.ts',
        'tests/helpers/{astro-preview,http-client}.ts',
        'tests/fixtures/astro-site/src/{actions/index,lib/wp-fetch-metrics,lib/acf-choice-label-mapper}.ts',
        'tests/integration/loaders/{live-loaders,route-caching-runtime}.test.ts',
      ],
      // Promise-returning API boundaries also turn synchronous failures into rejections.
      rules: { 'eslint/require-await': 'off' },
    },
    {
      files: [
        'tests/integration/actions/*.test.ts',
        'tests/helpers/astro-preview.ts',
      ],
      // Fixture cleanup and readiness polling deliberately run one request at a time.
      rules: { 'eslint/no-await-in-loop': 'off' },
    },
    {
      files: ['tests/helpers/{astro-preview,http-client}.ts'],
      // Node socket/process events require a Promise adapter.
      rules: {
        'promise/avoid-new': 'off',
        'promise/prefer-await-to-callbacks': 'off',
      },
    },
    {
      files: ['src/actions/post/client.ts', 'src/server/auth.ts'],
      // These callbacks are the public action/client factory API, not callback-based I/O.
      rules: { 'promise/prefer-await-to-callbacks': 'off' },
    },
    {
      files: ['src/integration.ts'],
      // Setup combines catalog refresh, optional CLI generation and Vite registration.
      rules: { 'eslint/complexity': ['error', { max: 22 }] },
    },
    {
      files: ['src/env.d.ts'],
      // The virtual-module declaration must describe both Astro error classes together.
      rules: { 'eslint/max-classes-per-file': 'off' },
    },
  ],
  env: core.env,
  // Preserve the existing declaration and expression style; control-flow exceptions are scoped in overrides.
  rules: {
    'eslint/no-shadow': 'off',
    'eslint/no-nested-ternary': 'off',
    'eslint/prefer-destructuring': 'off',
    'unicorn/import-style': 'off',
    'unicorn/custom-error-definition': 'off',
    'import/no-named-as-default-member': 'off',
    'eslint/func-style': 'off',
    'eslint/require-unicode-regexp': 'off',
    'eslint/prefer-named-capture-group': 'off',
    'unicorn/prefer-number-coercion': 'off',
    'unicorn/prefer-export-from': 'off',
    'eslint/no-use-before-define': 'off',
    'unicorn/consistent-function-scoping': 'off',
    'eslint/sort-keys': 'off',
    'typescript/method-signature-style': 'off',
  },
  extends: [core, astro, vitest, antiSlop],
  ignorePatterns: [...core.ignorePatterns, ...qualityIgnore],
});
