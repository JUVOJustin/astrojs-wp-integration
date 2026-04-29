import { execSync } from 'child_process';

const DEFAULT_WP_BASE_URL = 'http://localhost:8888';

type WpEnvStatus = {
  ports?: {
    development?: string;
  };
  urls?: {
    development?: string;
  };
};

/**
 * Rebuilds the wp-env development URL from the reported port when auto-port selection is active.
 */
function resolveWpEnvDevelopmentUrl(status: WpEnvStatus): string | undefined {
  const configuredUrl = status.urls?.development;
  const dynamicPort = status.ports?.development;

  if (!configuredUrl) {
    return dynamicPort ? `http://localhost:${dynamicPort}` : undefined;
  }

  if (!dynamicPort) {
    return configuredUrl;
  }

  try {
    const parsed = new URL(configuredUrl);
    parsed.port = dynamicPort;
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return `http://localhost:${dynamicPort}`;
  }
}

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
    return resolveWpEnvDevelopmentUrl(parsed) ?? DEFAULT_WP_BASE_URL;
  } catch {
    return DEFAULT_WP_BASE_URL;
  }
}
