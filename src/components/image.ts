import type { WordPressEmbeddedMedia, WordPressMedia } from 'fluent-wp-client';

export type WPImageOutputFormat =
  | 'avif'
  | 'png'
  | 'webp'
  | 'jpeg'
  | 'jpg'
  | 'svg';

type MediaSize = {
  file?: string;
  width: number;
  height: number;
  filesize?: number;
  mime_type?: string;
  source_url: string;
};

export type ResolvedWordPressImage = {
  src: string;
  srcset: string;
  width?: number;
  height?: number;
  alt: string;
  widths?: number[];
  fallbackFormat: WPImageOutputFormat;
};

/**
 * Framework-friendly image props for React/Svelte/Vue components.
 * Use resolveWordPressImage() to get WordPress media data,
 * or resolveWordPressImageForAstro() for Astro-aware optimization.
 */
export type WPImageFrameworkProps = {
  src: string;
  srcSet?: string;
  sizes?: string;
  width?: number;
  height?: number;
  alt: string;
  loading?: 'lazy' | 'eager';
  decoding?: 'async' | 'auto' | 'sync';
  fetchpriority?: 'high' | 'low' | 'auto';
};

export type ResolveWordPressImageOptions = {
  size?: string;
  alt?: string;
  width?: number;
  height?: number;
  widths?: number[];
  fallbackFormat?: WPImageOutputFormat;
};

type ResolvedSource = {
  src: string;
  width?: number;
  height?: number;
  mimeType?: string;
};

/** Resolves WordPress media metadata into image values usable by any renderer. */
export function resolveWordPressImage(
  media: WordPressMedia | WordPressEmbeddedMedia,
  options: ResolveWordPressImageOptions = {},
): ResolvedWordPressImage {
  const source = resolveSource(media, options);
  const width = resolveDimension(
    options.width,
    options.height,
    source.width,
    source.height,
  );
  const height = resolveDimension(
    options.height,
    options.width,
    source.height,
    source.width,
  );
  const sourceFormat =
    inferFormatFromUrl(source.src) ?? inferFormatFromMimeType(source.mimeType);

  return {
    src: source.src,
    srcset: generateWordPressSrcset(media),
    width,
    height,
    alt: options.alt ?? media.alt_text ?? media.title?.rendered ?? '',
    widths: resolveWidths(media, source.width, width, options.widths),
    fallbackFormat:
      normalizeOutputFormat(options.fallbackFormat) ?? sourceFormat ?? 'jpeg',
  };
}

function getMediaSizes(
  media: WordPressMedia | WordPressEmbeddedMedia,
): Record<string, MediaSize> {
  return (media.media_details?.sizes ?? {}) as Record<string, MediaSize>;
}

function getFullImage(
  media: WordPressMedia | WordPressEmbeddedMedia,
): ResolvedSource {
  return {
    src: media.source_url,
    width: media.media_details?.width,
    height: media.media_details?.height,
    mimeType: media.mime_type,
  };
}

function getRequestedImage(
  media: WordPressMedia | WordPressEmbeddedMedia,
  requestedSize: string | undefined,
): ResolvedSource | undefined {
  if (!requestedSize || requestedSize === 'full') {
    return undefined;
  }

  const mediaSize = getMediaSizes(media)[requestedSize];

  if (!mediaSize?.source_url) {
    return undefined;
  }

  return {
    src: mediaSize.source_url,
    width: mediaSize.width,
    height: mediaSize.height,
    mimeType: mediaSize.mime_type,
  };
}

function getBestImageForWidth(
  media: WordPressMedia | WordPressEmbeddedMedia,
  targetWidth: number | undefined,
): ResolvedSource | undefined {
  if (!targetWidth) {
    return undefined;
  }

  const candidate = Object.values(getMediaSizes(media))
    .filter((mediaSize) => mediaSize.source_url && mediaSize.width > 0)
    .sort((a, b) => a.width - b.width)
    .find((mediaSize) => mediaSize.width >= targetWidth);

  if (!candidate) {
    return undefined;
  }

  return {
    src: candidate.source_url,
    width: candidate.width,
    height: candidate.height,
    mimeType: candidate.mime_type,
  };
}

function resolveSource(
  media: WordPressMedia | WordPressEmbeddedMedia,
  options: ResolveWordPressImageOptions,
): ResolvedSource {
  return (
    getRequestedImage(media, options.size) ??
    getBestImageForWidth(media, options.width) ??
    getFullImage(media)
  );
}

function resolveDimension(
  requested: number | undefined,
  otherRequested: number | undefined,
  natural: number | undefined,
  otherNatural: number | undefined,
): number | undefined {
  if (requested) {
    return requested;
  }

  if (otherRequested && natural && otherNatural) {
    return Math.round((otherRequested * natural) / otherNatural);
  }

  return natural;
}

function getAllWordPressWidths(
  media: WordPressMedia | WordPressEmbeddedMedia,
): number[] {
  const widths = Object.values(getMediaSizes(media)).map(
    (mediaSize) => mediaSize.width,
  );

  if (media.media_details?.width) {
    widths.push(media.media_details.width);
  }

  return widths;
}

function resolveWidths(
  media: WordPressMedia | WordPressEmbeddedMedia,
  sourceWidth: number | undefined,
  targetWidth: number | undefined,
  customWidths: number[] | undefined,
): number[] | undefined {
  const widthValues = customWidths ?? getAllWordPressWidths(media);
  const maxWidth = sourceWidth ?? targetWidth;
  const resolved = widthValues
    .filter((width) => Number.isFinite(width) && width > 0)
    .filter((width) => !maxWidth || width <= maxWidth);

  if (targetWidth) {
    resolved.push(targetWidth);
  }

  const unique = [...new Set(resolved)].sort((a, b) => a - b);

  return unique.length > 1 ? unique : undefined;
}

function generateWordPressSrcset(
  media: WordPressMedia | WordPressEmbeddedMedia,
): string {
  const srcsetByWidth = new Map<number, string>();

  for (const mediaSize of Object.values(getMediaSizes(media))) {
    if (mediaSize.source_url && mediaSize.width > 0) {
      srcsetByWidth.set(mediaSize.width, mediaSize.source_url);
    }
  }

  if (media.source_url && media.media_details?.width) {
    srcsetByWidth.set(media.media_details.width, media.source_url);
  }

  return [...srcsetByWidth.entries()]
    .sort(([widthA], [widthB]) => widthA - widthB)
    .map(([width, sourceUrl]) => `${sourceUrl} ${width}w`)
    .join(', ');
}

function normalizeOutputFormat(
  format: string | undefined,
): WPImageOutputFormat | undefined {
  if (!format) {
    return undefined;
  }

  const normalized = format.toLowerCase();

  if (normalized === 'jpg') {
    return 'jpeg';
  }

  if (
    normalized === 'avif' ||
    normalized === 'png' ||
    normalized === 'webp' ||
    normalized === 'jpeg' ||
    normalized === 'svg'
  ) {
    return normalized;
  }

  return undefined;
}

function inferFormatFromUrl(src: string): WPImageOutputFormat | undefined {
  try {
    const extension = new URL(src).pathname.split('.').pop();
    return normalizeOutputFormat(extension);
  } catch {
    const extension = src.split('?')[0]?.split('#')[0]?.split('.').pop();
    return normalizeOutputFormat(extension);
  }
}

function inferFormatFromMimeType(
  mimeType: string | undefined,
): WPImageOutputFormat | undefined {
  return normalizeOutputFormat(mimeType?.split('/').pop());
}
