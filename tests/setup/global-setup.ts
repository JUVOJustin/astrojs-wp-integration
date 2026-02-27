import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { resolve } from 'path';

/** Temp file used to pass env vars from globalSetup to test workers */
const ENV_FILE = resolve(__dirname, '../../.test-env.json');

/** IDs of content created during seeding, used for cleanup */
const seededIds: { posts: number[]; pages: number[]; categories: number[]; tags: number[] } = {
  posts: [],
  pages: [],
  categories: [],
  tags: [],
};

/**
 * Runs a WP-CLI command inside the wp-env container and returns the WP-CLI
 * output only, stripping the wp-env runner log lines (ℹ/✔ prefixed)
 */
function wpCli(command: string): string {
  const raw = execSync(`npx wp-env run cli -- wp ${command}`, {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  return stripWpEnvOutput(raw);
}

/**
 * Runs an arbitrary shell command inside the wp-env cli container
 */
function wpEnvShell(command: string): string {
  const raw = execSync(`npx wp-env run cli -- bash -c "${command.replace(/"/g, '\\"')}"`, {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  return stripWpEnvOutput(raw);
}

/**
 * Strips wp-env status/info lines (ℹ/✔) from command output, returning
 * only the actual command stdout
 */
function stripWpEnvOutput(raw: string): string {
  const lines = raw.split('\n').filter(
    (line) =>
      line.trim() !== '' &&
      !line.startsWith('ℹ') &&
      !line.startsWith('✔') &&
      !line.startsWith('\u2139') &&
      !line.startsWith('\u2714')
  );

  return lines.join('\n').trim();
}

/**
 * Creates WordPress content via WP-CLI so every test file has data to work with
 */
function seedContent(): void {
  // Category
  const catId = wpCli('term create category "Test Category" --description="Integration test category" --porcelain');
  seededIds.categories.push(Number(catId));

  // Tag
  const tagId = wpCli('term create post_tag "Test Tag" --description="Integration test tag" --porcelain');
  seededIds.tags.push(Number(tagId));

  // Posts (2 so pagination logic is exercisable)
  for (let i = 1; i <= 2; i++) {
    const postId = wpCli(
      `post create --post_type=post --post_title="Test Post ${i}" --post_content="<p>Content for test post ${i}</p>" --post_status=publish --porcelain`
    );
    seededIds.posts.push(Number(postId));

    // Assign category and tag
    wpCli(`post term set ${postId} category ${catId}`);
    wpCli(`post term set ${postId} post_tag ${tagId}`);
  }

  // Page
  const pageId = wpCli(
    'post create --post_type=page --post_title="Test Page" --post_content="<p>Content for test page</p>" --post_status=publish --porcelain'
  );
  seededIds.pages.push(Number(pageId));
}

/**
 * Generates an application password for the admin user
 */
function createAppPassword(): string {
  const raw = wpCli('user application-password create admin vitest --porcelain');
  // Output format: "<password> <id>" — we need just the password (first token)
  return raw.split(/\s+/)[0];
}

/**
 * Installs a must-use plugin that force-enables application passwords over HTTP.
 * WordPress 6.x requires HTTPS for app passwords by default — this filter
 * overrides that for local development/testing.
 */
function enableAppPasswords(): void {
  wpEnvShell(
    'mkdir -p /var/www/html/wp-content/mu-plugins && echo \'<?php add_filter("wp_is_application_passwords_available", "__return_true");\' > /var/www/html/wp-content/mu-plugins/enable-app-passwords.php'
  );
}

/**
 * Waits for the WordPress REST API to respond before running tests
 */
async function waitForApi(baseUrl: string, maxAttempts = 30): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${baseUrl}/wp-json/wp/v2/posts`);
      if (res.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`WordPress API at ${baseUrl} did not become ready`);
}

/**
 * Global setup: called once before all integration tests
 */
export async function setup(): Promise<void> {
  const baseUrl = process.env.WP_BASE_URL || 'http://localhost:8888';

  console.log('[global-setup] Waiting for WordPress API...');
  await waitForApi(baseUrl);

  console.log('[global-setup] Enabling application passwords over HTTP...');
  enableAppPasswords();

  console.log('[global-setup] Creating application password...');
  const appPassword = createAppPassword();

  console.log('[global-setup] Seeding test content...');
  seedContent();

  // Persist env vars to a file so test workers can read them (globalSetup runs
  // in a separate process — process.env changes are not inherited by workers)
  const envData = {
    WP_BASE_URL: baseUrl,
    WP_APP_PASSWORD: appPassword,
    WP_SEEDED_POST_IDS: seededIds.posts.join(','),
    WP_SEEDED_PAGE_IDS: seededIds.pages.join(','),
    WP_SEEDED_CATEGORY_IDS: seededIds.categories.join(','),
    WP_SEEDED_TAG_IDS: seededIds.tags.join(','),
  };
  writeFileSync(ENV_FILE, JSON.stringify(envData), 'utf-8');

  // Also set in this process for convenience
  Object.assign(process.env, envData);

  console.log('[global-setup] Done. Seeded IDs:', JSON.stringify(seededIds));
}

/**
 * Global teardown: called once after all integration tests
 */
export async function teardown(): Promise<void> {
  console.log('[global-teardown] Cleaning up seeded content...');

  try {
    for (const id of seededIds.posts) {
      wpCli(`post delete ${id} --force`);
    }
    for (const id of seededIds.pages) {
      wpCli(`post delete ${id} --force`);
    }
    for (const id of seededIds.categories) {
      wpCli(`term delete category ${id}`);
    }
    for (const id of seededIds.tags) {
      wpCli(`term delete post_tag ${id}`);
    }
  } catch (e) {
    console.warn('[global-teardown] Non-critical cleanup error:', e);
  }

  // Remove the app password
  try {
    wpCli('user application-password delete admin --all');
  } catch {
    // Ignore — container may already be down
  }

  console.log('[global-teardown] Done.');

  // Remove temp env file
  try {
    unlinkSync(ENV_FILE);
  } catch {
    // File may already be gone
  }
}
