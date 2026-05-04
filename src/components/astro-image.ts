/// <reference types="astro/client" />
import { getConfiguredImageService, getImage, imageConfig } from 'astro:assets';
import type { AstroGlobal } from 'astro';
import type { WordPressEmbeddedMedia, WordPressMedia } from 'fluent-wp-client';
import {
  type ResolveWordPressImageOptions,
  resolveWordPressImage,
  type WPImageOutputFormat,
} from './image';

export type OptimizeMode = 'auto' | 'always' | 'never' | boolean;

export type WPImageSource = {
  type:
    | 'image/avif'
    | 'image/webp'
    | 'image/jpeg'
    | 'image/png'
    | 'image/svg+xml';
  srcSet: string;
  sizes?: string;
};

export type WPImageRenderProps =
  | {
      kind: 'picture';
      sources: WPImageSource[];
      img: WPImageImgProps;
    }
  | {
      kind: 'wordpress';
      img: WPImageImgProps;
    };

export type WPImageImgProps = {
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

export type ResolveWordPressImageForAstroOptions =
  ResolveWordPressImageOptions & {
    optimize?: OptimizeMode;
    formats?: WPImageOutputFormat[];
    quality?: number | 'low' | 'mid' | 'high' | 'max';
    sizes?: string;
    loading?: 'lazy' | 'eager';
    decoding?: 'async' | 'auto' | 'sync';
    fetchpriority?: 'high' | 'low' | 'auto';
  };

/**
 * Checks if Astro has a real runtime image service (not passthrough/noop).
 * Returns true for local services (Sharp) and external services (Cloudflare, Vercel, etc).
 * Returns false for passthrough/noop services.
 */
async function hasRuntimeImageService(): Promise<boolean> {
  try {
    const service = await getConfiguredImageService();
    if (!service) return false;

    // Check if it's passthrough service by checking the service config
    const serviceConfig = imageConfig.service;
    if (
      serviceConfig &&
      typeof serviceConfig === 'object' &&
      'entrypoint' in serviceConfig
    ) {
      const entrypoint = String(
        (serviceConfig as { entrypoint?: string }).entrypoint ?? '',
      );
      if (entrypoint.includes('passthrough') || entrypoint.includes('noop')) {
        return false;
      }
    }

    // If the service has a getURL method, it can optimize at runtime
    return typeof service.getURL === 'function';
  } catch {
    return false;
  }
}

/**
 * Determines whether to use Astro optimization or WordPress srcset based on:
 * 1. Explicit optimize prop
 * 2. Prerendered pages (always optimize)
 * 3. Runtime with real image service (optimize)
 * 4. Runtime without image service (passthrough - use WordPress srcset)
 */
async function shouldOptimize(
  optimize: OptimizeMode,
  isPrerendered: boolean,
): Promise<boolean> {
  // Explicit overrides
  if (optimize === 'always' || optimize === true) return true;
  if (optimize === 'never' || optimize === false) return false;

  // Prerendered/static pages always optimize at build time
  if (isPrerendered) return true;

  // Runtime: check if we have a real image service
  const hasService = await hasRuntimeImageService();
  return hasService;
}

/**
 * Generates optimized picture props using Astro's image pipeline.
 * Calls getImage() for each format + width combination.
 */
async function generateOptimizedPictureProps(
  imageData: ReturnType<typeof resolveWordPressImage>,
  formats: WPImageOutputFormat[],
  quality?: number | 'low' | 'mid' | 'high' | 'max',
  sizes?: string,
): Promise<WPImageRenderProps> {
  const sources: WPImageSource[] = [];
  const imgProps: WPImageImgProps = {
    src: imageData.src,
    alt: imageData.alt,
    width: imageData.width,
    height: imageData.height,
    sizes,
  };

  // Determine fallback format for the <img> tag
  // Use the source format (from original file extension) as fallback
  const fallbackFormat = imageData.fallbackFormat;

  // Generate optimized images for each format
  for (const format of formats) {
    try {
      const result = await getImage({
        src: imageData.src,
        width: imageData.width,
        height: imageData.height,
        widths: imageData.widths,
        format,
        quality,
      });

      const mimeType = format === 'jpg' ? 'image/jpeg' : `image/${format}`;
      const source: WPImageSource = {
        type: mimeType as WPImageSource['type'],
        srcSet: result.srcSet?.attribute ?? result.src,
        sizes,
      };

      sources.push(source);
    } catch {
      // Skip formats that fail (e.g. SVG to AVIF)
    }
  }

  // Generate fallback <img> using the original/fallback format
  if (fallbackFormat) {
    try {
      const fallbackResult = await getImage({
        src: imageData.src,
        width: imageData.width,
        height: imageData.height,
        widths: imageData.widths,
        format: fallbackFormat,
        quality,
      });

      imgProps.src = fallbackResult.src;
      if (fallbackResult.srcSet?.attribute) {
        imgProps.srcSet = fallbackResult.srcSet.attribute;
      }
    } catch {
      // Keep original src if fallback generation fails
    }
  }

  // If no sources generated, fall back to WordPress
  if (sources.length === 0) {
    return {
      kind: 'wordpress',
      img: {
        ...imgProps,
        srcSet: imageData.srcset || undefined,
      },
    };
  }

  return {
    kind: 'picture',
    sources,
    img: imgProps,
  };
}

/**
 * Astro-aware image resolver that decides between optimization and WordPress passthrough.
 *
 * Use this in .astro files or server-side code to get optimized images when possible,
 * and WordPress srcset when running runtime without image service.
 *
 * The returned props are serializable and can be passed to React/Svelte/Vue components.
 */
export async function resolveWordPressImageForAstro(
  Astro: AstroGlobal,
  media: WordPressMedia | WordPressEmbeddedMedia,
  options: ResolveWordPressImageForAstroOptions = {},
): Promise<WPImageRenderProps> {
  const {
    optimize = 'auto',
    formats = ['avif', 'webp'],
    quality,
    sizes = 'auto',
    loading = 'lazy',
    decoding = 'async',
    fetchpriority,
    ...resolveOptions
  } = options;

  const imageData = resolveWordPressImage(media, resolveOptions);
  const isPrerendered = Astro.isPrerendered ?? false;
  const useOptimization = await shouldOptimize(optimize, isPrerendered);

  const baseImgProps: WPImageImgProps = {
    src: imageData.src,
    alt: imageData.alt,
    width: imageData.width,
    height: imageData.height,
    loading,
    decoding,
    fetchpriority,
    sizes: sizes === 'auto' ? undefined : sizes,
  };

  if (useOptimization) {
    try {
      return await generateOptimizedPictureProps(
        imageData,
        formats,
        quality,
        sizes === 'auto' ? undefined : sizes,
      );
    } catch {
      // Fallback to WordPress on error
    }
  }

  // WordPress passthrough mode
  return {
    kind: 'wordpress',
    img: {
      ...baseImgProps,
      srcSet: imageData.srcset || undefined,
      sizes: imageData.srcset
        ? sizes === 'auto'
          ? undefined
          : sizes
        : undefined,
    },
  };
}
