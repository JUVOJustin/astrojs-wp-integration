<?php
/**
 * Registers a "genre" custom taxonomy for the "book" custom post type.
 *
 * Hierarchical taxonomy (like categories) with REST API support at
 * /wp-json/wp/v2/genres. Used by integration tests to verify term
 * actions work with custom taxonomies.
 */
add_action( 'init', function () {
	register_taxonomy( 'genre', 'book', [
		'labels'       => [
			'name'          => 'Genres',
			'singular_name' => 'Genre',
		],
		'public'       => true,
		'hierarchical' => true,
		'show_in_rest' => true,
		'rest_base'    => 'genres',
	] );
} );
