<?php
/**
 * Registers a 'genre' custom taxonomy for integration testing.
 *
 * Provides a REST-enabled taxonomy attached to the 'book' custom post type
 * to validate generic taxonomy loaders and term actions.
 */
add_action( 'init', function () {
	register_taxonomy( 'genre', [ 'book' ], [
		'label'        => 'Genres',
		'public'       => true,
		'show_in_rest' => true,
		'rest_base'    => 'genres',
		'hierarchical' => false,
	]);
});
