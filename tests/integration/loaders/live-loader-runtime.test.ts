import { describe, expect, it } from 'vitest';
import { getAstroDevUrl } from '../../helpers/action-client';

/**
 * Live loader runtime coverage through one real Astro SSR route.
 */
describe('Live Loaders: Astro runtime', () => {
  it('renders live post entries through Astro live collections', async () => {
    const response = await fetch(`${getAstroDevUrl()}/live-posts`);
    const html = await response.text();

    if (response.status !== 200) {
      throw new Error(`Expected status 200 but got ${response.status}: ${html}`);
    }

    expect(html).not.toContain('id="live-loader-error"');
    expect(html).toContain('Live Posts (100)');
    expect(html).toContain('<li data-id="');
    expect(html).toContain('Test Post 150');
    expect(html).toContain('Test Post 149');
    expect(html).toContain('Test Post 148');
  });

  it('renders mapped live entry values through the shared Astro mapper callback', async () => {
    const response = await fetch(`${getAstroDevUrl()}/live-mapped-entry`);
    const html = await response.text();

    if (response.status !== 200) {
      throw new Error(`Expected status 200 but got ${response.status}: ${html}`);
    }

    expect(html).not.toContain('id="live-mapped-entry-error"');
    expect(html).toContain('data-status="In progress"');
    expect(html).toContain('Project status: In progress');
  });
});
