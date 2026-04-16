import { execSync } from 'child_process';

const DEFAULT_WP_BASE_URL = 'http://localhost:8888';

type WpEnvStatus = {
  urls?: {
    development?: string;
  };
};

/**
 * Removes wp-env status log lines so JSON output can be parsed safely.
 */
function stripWpEnvOutput(raw: string): string {
  return raw
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();

      return trimmed !== '' && !trimmed.startsWith('ℹ') && !trimmed.startsWith('✔');
    })
    .join('\n')
    .trim();
}

/**
 * Resolves the active wp-env URL, respecting automatic port selection.
 */
export function resolveWpBaseUrl(): string {
  if (process.env.WP_BASE_URL) {
    return process.env.WP_BASE_URL;
  }

  try {
    const raw = execSync('npx wp-env status --json', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const parsed = JSON.parse(stripWpEnvOutput(raw)) as WpEnvStatus;
    return parsed.urls?.development ?? DEFAULT_WP_BASE_URL;
  } catch {
    return DEFAULT_WP_BASE_URL;
  }
}
