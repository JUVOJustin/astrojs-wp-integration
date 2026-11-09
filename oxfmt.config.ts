import { defineConfig } from 'oxfmt';
import ultracite from 'ultracite/oxfmt';

import { qualityIgnore } from './quality-ignore.ts';

export default defineConfig({
  ...ultracite,
  ignorePatterns: qualityIgnore,
  singleQuote: true,
});
