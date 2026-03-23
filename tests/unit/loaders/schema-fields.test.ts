import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  extractFieldsFromSchema,
  fieldsPresets,
  mergeFields,
  type ExtractFieldsOptions,
} from '../../../src/loaders/schema-fields';

describe('Schema Fields Utilities', () => {
  describe('extractFieldsFromSchema', () => {
    it('extracts flat fields from simple schema', () => {
      const schema = z.object({
        id: z.number(),
        name: z.string(),
        email: z.string(),
      });

      const fields = extractFieldsFromSchema(schema);

      expect(fields).toContain('id');
      expect(fields).toContain('name');
      expect(fields).toContain('email');
    });

    it('extracts fields without dot notation (WordPress compatible)', () => {
      const schema = z.object({
        id: z.number(),
        title: z.object({
          rendered: z.string(),
        }),
        content: z.object({
          rendered: z.string(),
          protected: z.boolean(),
        }),
      });

      const fields = extractFieldsFromSchema(schema);

      // WordPress REST API _fields parameter doesn't support dot notation
      // Requesting 'title' returns the full title object with 'rendered' property
      expect(fields).toContain('id');
      expect(fields).toContain('title');  // Not 'title.rendered'
      expect(fields).toContain('content'); // Not 'content.rendered' or 'content.protected'
      
      // Should NOT contain dot notation paths
      expect(fields).not.toContain('title.rendered');
      expect(fields).not.toContain('content.rendered');
      expect(fields).not.toContain('content.protected');
    });

    it('always includes id field', () => {
      const schema = z.object({
        name: z.string(),
      });

      const fields = extractFieldsFromSchema(schema);

      expect(fields).toContain('id');
    });

    it('handles optional fields based on requiredOnly option', () => {
      const schema = z.object({
        id: z.number(),
        required: z.string(),
        optional: z.string().optional(),
        withDefault: z.string().default('test'),
      });

      const allFields = extractFieldsFromSchema(schema, { requiredOnly: false });
      const requiredOnly = extractFieldsFromSchema(schema, { requiredOnly: true });

      expect(allFields).toContain('optional');
      expect(allFields).toContain('withDefault');
      expect(requiredOnly).not.toContain('optional');
      expect(requiredOnly).not.toContain('withDefault');
      expect(requiredOnly).toContain('required');
    });

    it('respects maxDepth for complex nested schemas', () => {
      const schema = z.object({
        id: z.number(),
        deeply: z.object({
          nested: z.object({
            object: z.object({
              value: z.string(),
            }),
          }),
        }),
      });

      // WordPress _fields only supports top-level fields, so all extractions
      // will just return the top-level field names regardless of maxDepth
      const shallow = extractFieldsFromSchema(schema, { maxDepth: 2 });
      const deep = extractFieldsFromSchema(schema, { maxDepth: 5 });

      // Both should contain 'deeply' as a top-level field (WordPress returns full nested object)
      expect(shallow).toContain('deeply');
      expect(deep).toContain('deeply');
      
      // Neither should contain dot notation (not supported by WordPress _fields)
      expect(shallow).not.toContain('deeply.nested');
      expect(deep).not.toContain('deeply.nested.object.value');
    });

    it('handles include option', () => {
      const schema = z.object({
        id: z.number(),
        name: z.string(),
      });

      const fields = extractFieldsFromSchema(schema, { include: ['meta', 'acf'] });

      expect(fields).toContain('meta');
      expect(fields).toContain('acf');
      expect(fields).toContain('id');
      expect(fields).toContain('name');
    });

    it('handles exclude option', () => {
      const schema = z.object({
        id: z.number(),
        name: z.string(),
        internal: z.string(),
      });

      const fields = extractFieldsFromSchema(schema, { exclude: ['internal'] });

      expect(fields).toContain('id');
      expect(fields).toContain('name');
      expect(fields).not.toContain('internal');
    });

    it('returns included fields for passthrough schemas', () => {
      const schema = z.object({
        id: z.number(),
      }).passthrough();

      const fields = extractFieldsFromSchema(schema);

      // Passthrough means any field is possible, so we can't pre-compute all fields
      // but we still include the mandatory id field
      expect(fields).toContain('id');
      expect(fields).toHaveLength(1);
    });

    it('handles extended schemas', () => {
      const baseSchema = z.object({
        id: z.number(),
        name: z.string(),
      });

      const extendedSchema = baseSchema.extend({
        email: z.string(),
      });

      const fields = extractFieldsFromSchema(extendedSchema);

      expect(fields).toContain('id');
      expect(fields).toContain('name');
      expect(fields).toContain('email');
    });

    it('throws error for non-Zod schemas', () => {
      expect(() => extractFieldsFromSchema({} as any)).toThrow('Expected a Zod schema');
    });

    it('deduplicates and sorts fields', () => {
      const schema = z.object({
        z: z.string(),
        a: z.string(),
        m: z.string(),
      });

      const fields = extractFieldsFromSchema(schema);

      // Should be sorted
      expect(fields).toEqual([...fields].sort());
      // Should have no duplicates
      expect(fields.length).toBe(new Set(fields).size);
    });
  });

  describe('fieldsPresets', () => {
    it('provides postList preset with essential listing fields', () => {
      expect(fieldsPresets.postList).toContain('id');
      expect(fieldsPresets.postList).toContain('title'); // Not 'title.rendered' - WordPress returns full object
      expect(fieldsPresets.postList).toContain('excerpt'); // Not 'excerpt.rendered'
      expect(fieldsPresets.postList).toContain('slug');
      expect(fieldsPresets.postList).toContain('link');
    });

    it('provides postFull preset with content fields', () => {
      expect(fieldsPresets.postFull).toContain('content'); // Not 'content.rendered' - WordPress returns full object
      expect(fieldsPresets.postFull).toContain('author');
      expect(fieldsPresets.postFull).toContain('categories');
      expect(fieldsPresets.postFull).toContain('tags');
    });

    it('provides pageList preset', () => {
      expect(fieldsPresets.pageList).toContain('id');
      expect(fieldsPresets.pageList).toContain('title'); // Not 'title.rendered'
      expect(fieldsPresets.pageList).toContain('parent');
      expect(fieldsPresets.pageList).toContain('menu_order');
    });

    it('provides pageFull preset', () => {
      expect(fieldsPresets.pageFull).toContain('content'); // Not 'content.rendered'
      expect(fieldsPresets.pageFull).toContain('featured_media');
    });

    it('provides mediaList preset', () => {
      expect(fieldsPresets.mediaList).toContain('source_url');
      expect(fieldsPresets.mediaList).toContain('media_details'); // Not 'media_details.width'
    });

    it('provides categoryList preset', () => {
      expect(fieldsPresets.categoryList).toContain('id');
      expect(fieldsPresets.categoryList).toContain('name');
      expect(fieldsPresets.categoryList).toContain('slug');
      expect(fieldsPresets.categoryList).toContain('count');
    });

    it('provides authorList preset', () => {
      expect(fieldsPresets.authorList).toContain('id');
      expect(fieldsPresets.authorList).toContain('name');
      expect(fieldsPresets.authorList).toContain('slug');
      expect(fieldsPresets.authorList).toContain('avatar_urls');
    });
  });

  describe('mergeFields', () => {
    it('merges multiple field arrays', () => {
      const result = mergeFields(
        ['id', 'title'],
        ['slug', 'content'],
        ['author']
      );

      expect(result).toContain('id');
      expect(result).toContain('title');
      expect(result).toContain('slug');
      expect(result).toContain('content');
      expect(result).toContain('author');
    });

    it('deduplicates fields', () => {
      const result = mergeFields(
        ['id', 'title'],
        ['title', 'slug'],
        ['slug', 'content']
      );

      expect(result.filter(f => f === 'title')).toHaveLength(1);
      expect(result.filter(f => f === 'slug')).toHaveLength(1);
    });

    it('sorts the result', () => {
      const result = mergeFields(
        ['z', 'a'],
        ['m', 'b']
      );

      expect(result).toEqual(['a', 'b', 'm', 'z']);
    });

    it('ignores undefined sources', () => {
      const result = mergeFields(
        ['id', 'title'],
        undefined,
        ['slug']
      );

      expect(result).toContain('id');
      expect(result).toContain('title');
      expect(result).toContain('slug');
    });

    it('handles empty arrays', () => {
      const result = mergeFields(
        [],
        ['id'],
        []
      );

      expect(result).toEqual(['id']);
    });
  });

  describe('Integration with WordPress schemas', () => {
    it('works with post-like schemas', () => {
      const postLikeSchema = z.object({
        id: z.number(),
        title: z.object({
          rendered: z.string(),
        }),
        excerpt: z.object({
          rendered: z.string(),
          protected: z.boolean(),
        }),
        slug: z.string(),
        date: z.string(),
        modified: z.string(),
        status: z.string(),
        link: z.string(),
        author: z.number(),
        featured_media: z.number().optional(),
        categories: z.array(z.number()).optional(),
        tags: z.array(z.number()).optional(),
        meta: z.record(z.string(), z.any()).optional(),
      });

      const fields = extractFieldsFromSchema(postLikeSchema);

      // Core fields should be present (without dot notation - WordPress compatible)
      expect(fields).toContain('id');
      expect(fields).toContain('title');        // Not 'title.rendered'
      expect(fields).toContain('excerpt');       // Not 'excerpt.rendered'
      expect(fields).toContain('slug');
      
      // Should NOT contain dot notation paths (not supported by WordPress _fields)
      expect(fields).not.toContain('title.rendered');
      expect(fields).not.toContain('excerpt.rendered');
      
      // Meta should be included (optional but in schema)
      expect(fields).toContain('meta');
    });

    it('combines preset with custom fields', () => {
      const customFields = extractFieldsFromSchema(
        z.object({
          id: z.number(),
          custom_field: z.string(),
        })
      );

      const combined = mergeFields(
        fieldsPresets.postList,
        customFields
      );

      expect(combined).toContain('title');     // from preset (not 'title.rendered')
      expect(combined).toContain('slug');      // from preset
      expect(combined).toContain('custom_field'); // from custom
    });
  });
});
