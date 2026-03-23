/**
 * Utilities for extracting WordPress REST API field lists from Zod schemas.
 * 
 * These helpers enable automatic `_fields` parameter generation for optimizing
 * WordPress REST API requests, reducing payload sizes and improving performance.
 * 
 * Compatible with Zod v4.x
 * 
 * @module
 */

import type { z } from 'zod';

/**
 * Options for extracting fields from Zod schemas.
 */
export interface ExtractFieldsOptions {
  /** Include only required fields (exclude optional ones) */
  requiredOnly?: boolean;
  /** Maximum depth for nested object traversal */
  maxDepth?: number;
  /** Additional fields to always include */
  include?: string[];
  /** Fields to exclude from the result */
  exclude?: string[];
}

/**
 * Zod v4 type definition properties.
 */
type ZodDef = {
  type?: string;
  innerType?: z.ZodTypeAny;
  schema?: z.ZodTypeAny;
  left?: z.ZodTypeAny;
  right?: z.ZodTypeAny;
  shape?: Record<string, z.ZodTypeAny>;
  catchall?: z.ZodTypeAny;
};

/**
 * Checks if a value is a Zod schema object.
 */
function isZodSchema(value: unknown): value is z.ZodTypeAny {
  return (
    typeof value === 'object' &&
    value !== null &&
    '_def' in value &&
    typeof (value as { _def?: unknown })._def === 'object'
  );
}

/**
 * Gets the inner schema from a Zod wrapper type (optional, nullable, etc.)
 */
function unwrapZodSchema(schema: z.ZodTypeAny): z.ZodTypeAny {
  const def = schema._def as ZodDef;
  const type = def.type;
  
  // Unwrap optional, nullable, default, etc.
  // In Zod v4, these are handled via innerType
  if ((type === 'optional' || type === 'nullable') && def.innerType) {
    return unwrapZodSchema(def.innerType);
  }
  
  // For effects, unwrap the inner schema
  if (type === 'effects' && def.schema) {
    return unwrapZodSchema(def.schema);
  }
  
  return schema;
}

/**
 * Gets the type identifier from a Zod schema definition.
 */
function getZodType(schema: z.ZodTypeAny): string | undefined {
  const def = schema._def as ZodDef;
  return def.type;
}

/**
 * Recursively extracts field paths from a Zod schema.
 * 
 * Note: WordPress REST API _fields parameter only supports top-level field names.
 * When you request 'title', you get the full title object including 'rendered'.
 * Dot notation like 'title.rendered' is NOT supported by WordPress REST API.
 */
function extractFieldPaths(
  schema: z.ZodTypeAny,
  prefix: string = '',
  depth: number = 0,
  maxDepth: number = 5,
  requiredOnly: boolean = false,
): string[] {
  if (depth >= maxDepth) {
    return prefix ? [prefix] : [];
  }

  const unwrapped = unwrapZodSchema(schema);
  const type = getZodType(unwrapped);

  // Handle object schemas
  if (type === 'object') {
    const def = unwrapped._def as ZodDef;
    const shape = def.shape;
    
    if (!shape || typeof shape !== 'object') {
      return [];
    }
    
    const fields: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      // WordPress REST API _fields parameter only supports top-level fields
      // We don't use dot notation (e.g., 'title.rendered' - just 'title')
      const fieldPath = prefix ? `${prefix}.${key}` : key;
      
      if (!isZodSchema(value)) {
        continue;
      }

      const valueUnwrapped = unwrapZodSchema(value);
      const valueType = getZodType(valueUnwrapped);
      
      // Check if original field is optional by looking at its type before unwrapping
      const originalType = getZodType(value);
      const isOptional = originalType === 'optional' || originalType === 'default';

      if (requiredOnly && isOptional) {
        continue;
      }

      // Add the field path
      fields.push(fieldPath);

      // Handle nested objects - but we only go one level deep for WordPress
      // since _fields doesn't support dot notation
      if (valueType === 'object' && !prefix && depth < 1) {
        // For nested objects at root level, we might want to include them
        // but WordPress will return the full object anyway
        // So we don't recursively extract nested paths
      }
    }

    return fields;
  }

  // Handle intersection types (e.g., schema.extend())
  if (type === 'intersection') {
    const def = unwrapped._def as ZodDef;
    const left = def.left as z.ZodTypeAny | undefined;
    const right = def.right as z.ZodTypeAny | undefined;
    
    const leftFields = left ? extractFieldPaths(left, prefix, depth, maxDepth, requiredOnly) : [];
    const rightFields = right ? extractFieldPaths(right, prefix, depth, maxDepth, requiredOnly) : [];
    return [...leftFields, ...rightFields];
  }

  // Handle passthrough - if passthrough, we can't know all fields in advance
  // Check if there's a catchall that's an unknown type
  const def = unwrapped._def as ZodDef;
  if (type === 'object' && def.catchall) {
    const catchallDef = def.catchall._def as ZodDef | undefined;
    if (catchallDef?.type === 'unknown' || catchallDef?.type === 'any') {
      return []; // Passthrough means any field is possible
    }
  }

  // For primitive types at root level
  if (!prefix) {
    return [];
  }

  return [prefix];
}

/**
 * Extracts WordPress REST API _fields parameter values from a Zod schema.
 * 
 * This utility analyzes Zod schemas and generates the field paths needed for
 * WordPress `_fields` parameter optimization. Nested objects are flattened to
 * dot-notation paths (e.g., 'title.rendered', 'content.rendered').
 * 
 * @param schema - Zod schema to extract fields from
 * @param options - Extraction options
 * @returns Array of field paths suitable for _fields parameter, or empty array if schema uses passthrough
 * 
 * @example
 * ```typescript
 * import { z } from 'zod';
 * import { extractFieldsFromSchema } from 'wp-astrojs-integration';
 * 
 * const postSchema = z.object({
 *   id: z.number(),
 *   title: z.object({ rendered: z.string() }),
 *   content: z.object({ rendered: z.string() }),
 *   excerpt: z.object({ rendered: z.string() }),
 * });
 * 
 * const fields = extractFieldsFromSchema(postSchema);
 * // ['id', 'title', 'title.rendered', 'content', 'content.rendered', 'excerpt', 'excerpt.rendered']
 * 
 * // Use in loader
 * const loader = wordPressPostLoader(client, { fields });
 * ```
 */
export function extractFieldsFromSchema<T extends z.ZodTypeAny>(
  schema: T,
  options: ExtractFieldsOptions = {}
): string[] {
  if (!isZodSchema(schema)) {
    throw new TypeError('Expected a Zod schema');
  }

  const { 
    requiredOnly = false, 
    maxDepth = 5,
    include = [],
    exclude = [] 
  } = options;

  // Always include id field
  const baseInclude = ['id'];
  const allInclude = [...baseInclude, ...include];
  
  // Extract fields from schema
  let fields = extractFieldPaths(schema, '', 0, maxDepth, requiredOnly);
  
  // If no fields were extracted (e.g., passthrough), return empty array
  // but still include the manually specified fields
  if (fields.length === 0) {
    const def = schema._def as ZodDef;
    // Check if it's a passthrough schema
    if (def.catchall) {
      const catchallDef = def.catchall._def as ZodDef | undefined;
      if (catchallDef?.type === 'unknown' || catchallDef?.type === 'any') {
        return allInclude;
      }
    }
  }
  
  // Add explicitly included fields
  fields = [...new Set([...allInclude, ...fields])];
  
  // Remove excluded fields
  if (exclude.length > 0) {
    fields = fields.filter(field => !exclude.includes(field));
  }
  
  // Sort and deduplicate
  return [...new Set(fields)].sort();
}

/**
 * Creates a minimal field list for common use cases.
 * 
 * These presets provide optimized field selections for typical scenarios,
 * reducing payload size while including essential data.
 */
export const fieldsPresets = {
  /** 
   * Minimal fields for post listings (title, excerpt, slug, date).
   * Use for index pages or post lists.
   * Note: WordPress REST API returns full objects (e.g., 'title' includes 'rendered')
   */
  postList: [
    'id', 'title', 'excerpt',
    'slug', 'date', 'modified', 'status', 'link'
  ] as const,

  /**
   * Essential post fields for full content display.
   * Use for single post pages.
   */
  postFull: [
    'id', 'title', 'content', 'excerpt',
    'slug', 'date', 'modified', 'status', 'link',
    'author', 'featured_media', 'categories', 'tags'
  ] as const,

  /**
   * Minimal fields for page listings.
   * Use for navigation menus or page lists.
   */
  pageList: [
    'id', 'title',
    'slug', 'link', 'parent', 'menu_order'
  ] as const,

  /**
   * Essential page fields for full content display.
   * Use for single page display.
   */
  pageFull: [
    'id', 'title', 'content', 'excerpt',
    'slug', 'date', 'modified', 'status', 'link',
    'author', 'featured_media', 'parent', 'menu_order'
  ] as const,

  /**
   * Media fields for image galleries or thumbnails.
   */
  mediaList: [
    'id', 'title', 'alt_text', 'caption',
    'media_type', 'mime_type', 'source_url',
    'media_details'
  ] as const,

  /**
   * Category fields for taxonomy listings.
   */
  categoryList: [
    'id', 'name', 'slug', 'description', 'count', 'parent', 'link'
  ] as const,

  /**
   * User/Author fields for bylines or author pages.
   */
  authorList: [
    'id', 'name', 'slug', 'link', 'avatar_urls', 'description'
  ] as const,
};

/**
 * Combines multiple field sources into a unique sorted array.
 * 
 * @param sources - Arrays of field paths to merge
 * @returns Deduplicated and sorted array of field paths
 * 
 * @example
 * ```typescript
 * const fields = mergeFields(
 *   fieldsPresets.postList,
 *   ['meta', 'acf'],
 *   extractFieldsFromSchema(customSchema)
 * );
 * ```
 */
export function mergeFields(...sources: (readonly string[] | string[] | undefined)[]): string[] {
  const allFields = sources
    .filter((s): s is readonly string[] | string[] => Array.isArray(s))
    .flat();
  
  return [...new Set(allFields)].sort();
}
