<?php
/**
 * Registers ACF field groups for integration testing.
 *
 * Creates a single field group — "Test Content Fields" — applied to posts,
 * pages, and the book CPT. The group includes:
 *   - Scalar fields: text (subtitle), textarea (summary), number (priority_score), url (external_url)
 *   - Relationship field: acf_related_posts — returns post objects so the REST
 *     response includes ACF's _link property pointing to each post's REST endpoint.
 *   - Post object field: acf_featured_post — single post object; REST response
 *     similarly includes _link.
 *
 * Only runs when ACF is active (guarded by the acf/init action and an
 * existence check on acf_add_local_field_group). show_in_rest exposes all
 * fields under the `acf` key in WP REST API responses.
 */
add_action( 'acf/init', function () {
	if ( ! function_exists( 'acf_add_local_field_group' ) ) {
		return;
	}

	acf_add_local_field_group( [
		'key'   => 'group_test_content_fields',
		'title' => 'Test Content Fields',

		'fields' => [

			// ── Subtitle (text) ─────────────────────────────────────────────────
			[
				'key'   => 'field_acf_subtitle',
				'name'  => 'acf_subtitle',
				'label' => 'Subtitle',
				'type'  => 'text',
			],

			// ── Summary (textarea) ───────────────────────────────────────────────
			[
				'key'   => 'field_acf_summary',
				'name'  => 'acf_summary',
				'label' => 'Summary',
				'type'  => 'textarea',
				'rows'  => 4,
			],

			// ── Priority Score (number, 0–100) ──────────────────────────────────
			[
				'key'   => 'field_acf_priority_score',
				'name'  => 'acf_priority_score',
				'label' => 'Priority Score',
				'type'  => 'number',
				'min'   => 0,
				'max'   => 100,
			],

			// ── External URL (url) ───────────────────────────────────────────────
			[
				'key'   => 'field_acf_external_url',
				'name'  => 'acf_external_url',
				'label' => 'External URL',
				'type'  => 'url',
			],

			// ── Related Posts (relationship) ─────────────────────────────────────
			// return_format=object causes ACF to format each related post as a
			// full post object in the REST response, including a _link property
			// with the WP REST API URL for that post.
			[
				'key'           => 'field_acf_related_posts',
				'name'          => 'acf_related_posts',
				'label'         => 'Related Posts',
				'type'          => 'relationship',
				'post_type'     => [ 'post' ],
				'return_format' => 'object',
				'min'           => 0,
				'max'           => 5,
			],

			// ── Featured Post (post_object) ──────────────────────────────────────
			// Single post object reference; REST response includes _link.
			[
				'key'           => 'field_acf_featured_post',
				'name'          => 'acf_featured_post',
				'label'         => 'Featured Post',
				'type'          => 'post_object',
				'post_type'     => [ 'post' ],
				'return_format' => 'object',
				'allow_null'    => 1,
			],
		],

		// Applies to posts, pages, and the book CPT.
		'location' => [
			[ [ 'param' => 'post_type', 'operator' => '==', 'value' => 'post' ] ],
			[ [ 'param' => 'post_type', 'operator' => '==', 'value' => 'page' ] ],
			[ [ 'param' => 'post_type', 'operator' => '==', 'value' => 'book' ] ],
		],

		// Expose all fields in the `acf` key of WP REST API responses.
		'show_in_rest' => 1,
	] );
} );
