import { describe, expect, it } from 'vitest';
import { getAstroDevUrl } from '../../helpers/action-client';

function extractImageTag(html: string, className: string): string {
  const match = html.match(
    new RegExp(`<img(?=[^>]*class="${className}")[^>]*>`, 's'),
  );

  if (!match) {
    throw new Error(`Missing image tag for class ${className}.`);
  }

  return match[0];
}

/** WPImage application coverage through real Astro routes and WordPress media. */
describe('WPImage: Astro runtime', () => {
  it('uses Astro Picture by default and WordPress srcset when requested', async () => {
    const response = await fetch(`${getAstroDevUrl()}/wp-image-live`);
    const html = await response.text();

    if (response.status !== 200) {
      throw new Error(
        `Expected status 200 but got ${response.status}: ${html}`,
      );
    }

    expect(html).not.toContain('id="wp-image-live-error"');

    const astroImageTag = extractImageTag(html, 'live-astro-wp-image');
    expect(astroImageTag).toContain('/_image?');
    expect(astroImageTag).toContain('alt="WPImage seeded alt text"');
    expect(html).toContain('type="image/avif"');
    expect(html).toContain('type="image/webp"');

    const wordpressImageTag = extractImageTag(html, 'live-wordpress-wp-image');
    expect(wordpressImageTag).toContain('/wp-content/uploads/');
    expect(wordpressImageTag).toContain('srcset=');
    expect(wordpressImageTag).not.toContain('/_image?');
  });
});
