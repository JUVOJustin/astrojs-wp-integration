import { describe, expect, it } from 'vitest';
import { getAstroDevUrl } from '../../helpers/action-client';

/**
 * Live loader runtime coverage through one real Astro SSR route.
 */
describe('Live Loaders: Astro runtime', () => {
  it('renders live collection entries through the shared Astro fixture route', async () => {
    const response = await fetch(`${getAstroDevUrl()}/live-posts`);
    const html = await response.text();

    if (response.status !== 200) {
      throw new Error(`Expected status 200 but got ${response.status}: ${html}`);
    }

    expect(html).not.toContain('id="live-loader-error"');
    expect(html).toMatch(/Live Posts \(\d+\)/);

    const countMatch = html.match(/Live Posts \((\d+)\)/);
    expect(countMatch).not.toBeNull();
    const count = parseInt(countMatch![1], 10);
    expect(count).toBeGreaterThan(0);

    expect(html).toContain('<li data-id="');
  });
});
