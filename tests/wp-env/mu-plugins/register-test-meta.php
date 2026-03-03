<?php
/**
 * Registers test meta fields for posts, pages, and books.
 *
 * Covers all six WordPress meta types (string, boolean, integer, number, array,
 * object) with varied auth_callback settings to exercise different permission
 * paths in integration tests.
 *
 * Meta fields are registered per-subtype (post, page, book) using
 * register_post_meta() so they only appear on the types we test against.
 * One additional field (test_book_isbn) is registered only for the book CPT
 * to verify subtype-specific behaviour.
 */
add_action( 'init', function () {

	/**
	 * Registers a meta field on posts, pages, and books in one call.
	 */
	$register_for_all = function ( string $meta_key, array $args ): void {
		foreach ( [ 'post', 'page', 'book' ] as $post_type ) {
			register_post_meta( $post_type, $meta_key, $args );
		}
	};

	// ── String ── auth: always allowed ──────────────────────────────────
	$register_for_all( 'test_string_meta', [
		'type'          => 'string',
		'single'        => true,
		'show_in_rest'  => true,
		'auth_callback' => '__return_true',
	] );

	// ── Boolean ── auth: requires edit_posts capability ─────────────────
	$register_for_all( 'test_boolean_meta', [
		'type'          => 'boolean',
		'single'        => true,
		'show_in_rest'  => true,
		'auth_callback' => function ( $allowed, $meta_key, $object_id, $user_id ) {
			return user_can( $user_id, 'edit_posts' );
		},
	] );

	// ── Integer ── auth: requires publish_posts capability ──────────────
	$register_for_all( 'test_integer_meta', [
		'type'          => 'integer',
		'single'        => true,
		'show_in_rest'  => true,
		'auth_callback' => function ( $allowed, $meta_key, $object_id, $user_id ) {
			return user_can( $user_id, 'publish_posts' );
		},
	] );

	// ── Number (float) ── auth: always allowed ──────────────────────────
	$register_for_all( 'test_number_meta', [
		'type'          => 'number',
		'single'        => true,
		'show_in_rest'  => true,
		'auth_callback' => '__return_true',
	] );

	// ── Array of strings ── auth: always allowed ────────────────────────
	// WordPress requires show_in_rest.schema.items for array meta types.
	$register_for_all( 'test_array_meta', [
		'type'          => 'array',
		'single'        => true,
		'show_in_rest'  => [
			'schema' => [
				'items' => [
					'type' => 'string',
				],
			],
		],
		'auth_callback' => '__return_true',
	] );

	// ── Object with typed properties ── auth: requires edit_published_posts ─
	// WordPress requires show_in_rest.schema.properties for object meta types.
	$register_for_all( 'test_object_meta', [
		'type'          => 'object',
		'single'        => true,
		'show_in_rest'  => [
			'schema' => [
				'type'       => 'object',
				'properties' => [
					'city' => [ 'type' => 'string' ],
					'zip'  => [ 'type' => 'string' ],
					'lat'  => [ 'type' => 'number' ],
					'lng'  => [ 'type' => 'number' ],
				],
			],
		],
		'auth_callback' => function ( $allowed, $meta_key, $object_id, $user_id ) {
			return user_can( $user_id, 'edit_published_posts' );
		},
	] );

	// ── Read-only string ── auth: always denied ─────────────────────────
	// Tests that writes to this field are rejected by the REST API.
	$register_for_all( 'test_readonly_meta', [
		'type'          => 'string',
		'single'        => true,
		'default'       => 'immutable',
		'show_in_rest'  => true,
		'auth_callback' => '__return_false',
	] );

	// ── Book-only ISBN ── subtype-specific registration ─────────────────
	// Only registered for the 'book' CPT; should not appear on posts or pages.
	register_post_meta( 'book', 'test_book_isbn', [
		'type'          => 'string',
		'single'        => true,
		'show_in_rest'  => true,
		'auth_callback' => '__return_true',
	] );
} );
