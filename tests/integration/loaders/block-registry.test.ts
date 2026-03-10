import { describe, it, expect } from 'vitest';
import { resolveWordPressBlockComponent } from '../../../src/blocks';
import { createJwtAuthClient } from '../../helpers/wp-client';

/**
 * Integration coverage for Gutenberg block registry resolution.
 */
describe('Gutenberg block registry resolution', () => {
  it('maps core blocks through short-name aliases', async () => {
    const client = createJwtAuthClient();
    const blocks = await client.getPostBySlug('test-post-001').getBlocks();

    if (!blocks) {
      throw new Error('Expected parsed blocks for test-post-001.');
    }

    const paragraphComponent = Symbol('paragraph-component');
    const headingComponent = Symbol('heading-component');
    const imageComponent = Symbol('image-component');

    const registry = {
      paragraph: paragraphComponent,
      heading: headingComponent,
      image: imageComponent,
    };

    const resolvedParagraph = blocks
      .map((block) => resolveWordPressBlockComponent(registry, block.blockName))
      .find((resolved) => resolved === paragraphComponent);

    const resolvedImage = blocks
      .map((block) => resolveWordPressBlockComponent(registry, block.blockName))
      .find((resolved) => resolved === imageComponent);

    const resolvedHeading = blocks
      .map((block) => resolveWordPressBlockComponent(registry, block.blockName))
      .find((resolved) => resolved === headingComponent);

    expect(resolvedParagraph).toBe(paragraphComponent);
    expect(resolvedHeading).toBe(headingComponent);
    expect(resolvedImage).toBe(imageComponent);
  });

  it('returns undefined for unmapped blocks so handling stays optional', async () => {
    const client = createJwtAuthClient();
    const blocks = await client.getPageBySlug('about').getBlocks();

    if (!blocks) {
      throw new Error('Expected parsed blocks for about page.');
    }

    const unresolved = blocks
      .map((block) => resolveWordPressBlockComponent({}, block.blockName))
      .every((value) => value === undefined);

    expect(unresolved).toBe(true);
  });
});
