/**
 * Server-side authentication helpers for Astro Actions and middleware.
 */
export {
  createWordPressAuthBridge,
  wordPressLoginInputSchema,
} from './auth';

export type {
  WordPressAuthBridge,
  WordPressAuthBridgeConfig,
  WordPressAuthSession,
  WordPressLoginAction,
  WordPressLoginActionResult,
  WordPressLoginInput,
} from './auth';
