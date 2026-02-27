<?php
/**
 * Registers a 'book' custom post type for integration testing.
 *
 * Provides a realistic CPT with REST API support, used to verify
 * that the execute* action functions work with non-standard post types.
 * The rest_base 'books' means the endpoint is /wp-json/wp/v2/books.
 */
add_action( 'init', function () {
	register_post_type( 'book', [
		'label'        => 'Books',
		'public'       => true,
		'show_in_rest' => true,
		'rest_base'    => 'books',
		'supports'     => [
			'title',
			'editor',
			'author',
			'thumbnail',
			'excerpt',
			'custom-fields',
			'comments',
		],
	]);
});
