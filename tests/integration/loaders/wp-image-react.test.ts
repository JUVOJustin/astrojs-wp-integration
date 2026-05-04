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

/** React component image rendering coverage through real Astro routes. */
describe('WPImage: React component', () => {
  it('renders WordPress srcset in React client islands', async () => {
    const response = await fetch(`${getAstroDevUrl()}/wp-image-react`);
    const html = await response.text();

    if (response.status !== 200) {
      throw new Error(
        `Expected status 200 but got ${response.status}: ${html}`,
      );
    }

    expect(html).not.toContain('id="react-image-error"');

    const reactImageTag = extractImageTag(html, 'react-wp-image');
    expect(reactImageTag).toContain('/wp-content/uploads/');
    expect(reactImageTag).toMatch(/srcset=|srcSet=/i);
    expect(reactImageTag).toContain('alt="WPImage seeded alt text"');
    expect(reactImageTag).not.toContain('/_image?');
    expect(reactImageTag).not.toContain('/_astro/');
  });
});
