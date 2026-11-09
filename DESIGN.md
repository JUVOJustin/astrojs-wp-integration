---
title: Component presentation
description: Presentation ownership for the reusable WordPress components and integration fixture.
tokens:
  color: inherit
  typography: inherit
  spacing: inherit
---

## Library components

WPContent renders WordPress HTML in the consuming application's typography and color system. WPImage delegates image rendering to Astro assets. These components do not establish a brand, global stylesheet, or application layout. Preserve consumer styling and semantic markup.

## Integration fixture

The fixture pages exist to assert content, action, authentication, and caching contracts. They use semantic HTML and browser defaults; their data attributes are test contracts, not design tokens. A visual redesign is outside this fixture's purpose.
