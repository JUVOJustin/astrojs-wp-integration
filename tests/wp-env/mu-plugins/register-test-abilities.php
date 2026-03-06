<?php
/**
 * Registers test abilities for integration testing of the Abilities API.
 *
 * Provides three abilities exercising each HTTP method for the /run endpoint:
 * - test/get-site-title  (readonly: true)  → GET  /run
 * - test/update-option   (readonly: false) → POST /run
 * - test/delete-option   (destructive: true) → DELETE /run
 *
 * All abilities are registered with show_in_rest => true so they are
 * accessible via the REST API.  The guard on wp_register_ability() ensures
 * the file is silently skipped on WordPress versions older than 6.9.
 */
if ( ! function_exists( 'wp_register_ability' ) ) {
	return;
}

add_action( 'init', function () {

	// ── Read-only ability (GET /run) ──────────────────────────────────────
	wp_register_ability( 'test/get-site-title', [
		'label'               => 'Get Site Title',
		'description'         => 'Returns the site title (read-only test ability).',
		'category'            => 'test',
		'output_schema'       => [
			'type'       => 'object',
			'properties' => [
				'title' => [ 'type' => 'string' ],
			],
		],
		'permission_callback' => function () {
			return current_user_can( 'read' );
		},
		'execute_callback'    => function () {
			return [ 'title' => get_bloginfo( 'name' ) ];
		},
		'meta'                => [
			'show_in_rest' => true,
			'annotations'  => [
				'readonly'    => true,
				'destructive' => false,
			],
		],
	] );

	// ── Regular ability (POST /run) ───────────────────────────────────────
	wp_register_ability( 'test/update-option', [
		'label'               => 'Update Test Option',
		'description'         => 'Updates the test_ability_option value (regular test ability).',
		'category'            => 'test',
		'input_schema'        => [
			'type'       => 'object',
			'properties' => [
				'value' => [ 'type' => 'string' ],
			],
			'required'   => [ 'value' ],
		],
		'output_schema'       => [
			'type'       => 'object',
			'properties' => [
				'previous' => [ 'type' => 'string' ],
				'current'  => [ 'type' => 'string' ],
			],
		],
		'permission_callback' => function () {
			return current_user_can( 'manage_options' );
		},
		'execute_callback'    => function ( $input ) {
			$previous = get_option( 'test_ability_option', '' );
			update_option( 'test_ability_option', $input['value'] );
			return [ 'previous' => $previous, 'current' => $input['value'] ];
		},
		'meta'                => [
			'show_in_rest' => true,
			'annotations'  => [
				'readonly'    => false,
				'destructive' => false,
			],
		],
	] );

	// ── Destructive ability (DELETE /run) ──────────────────────────────────
	wp_register_ability( 'test/delete-option', [
		'label'               => 'Delete Test Option',
		'description'         => 'Deletes the test_ability_option value (destructive test ability).',
		'category'            => 'test',
		'output_schema'       => [
			'type'       => 'object',
			'properties' => [
				'deleted'  => [ 'type' => 'boolean' ],
				'previous' => [ 'type' => 'string' ],
			],
		],
		'permission_callback' => function () {
			return current_user_can( 'manage_options' );
		},
		'execute_callback'    => function () {
			$previous = get_option( 'test_ability_option', '' );
			delete_option( 'test_ability_option' );
			return [ 'deleted' => true, 'previous' => $previous ];
		},
		'meta'                => [
			'show_in_rest' => true,
			'annotations'  => [
				'readonly'    => false,
				'destructive' => true,
			],
		],
	] );
} );
