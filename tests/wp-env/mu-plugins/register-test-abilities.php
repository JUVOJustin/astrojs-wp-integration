<?php
/**
 * Registers test abilities for integration testing of the Abilities API.
 *
 * Provides five abilities exercising each HTTP method for the /run endpoint:
 * - test/get-site-title    (readonly: true)   → GET  /run  (simple schema)
 * - test/get-complex-data  (readonly: true)   → GET  /run  (complex nested input/output)
 * - test/update-option     (readonly: false)  → POST /run  (simple schema)
 * - test/process-complex   (readonly: false)  → POST /run  (complex nested input/output)
 * - test/delete-option     (destructive: true) → DELETE /run
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

	// ── Read-only ability with complex input/output (GET /run) ────────────
	wp_register_ability( 'test/get-complex-data', [
		'label'               => 'Get Complex Data',
		'description'         => 'Returns complex nested data based on input filters (read-only test ability with complex schema).',
		'category'            => 'test',
		'input_schema'        => [
			'type'       => 'object',
			'properties' => [
				'user_id'      => [ 'type' => 'integer' ],
				'include_meta' => [ 'type' => 'boolean' ],
			],
			'required'   => [ 'user_id' ],
		],
		'output_schema'       => [
			'type'       => 'object',
			'properties' => [
				'user'  => [
					'type'       => 'object',
					'properties' => [
						'id'    => [ 'type' => 'integer' ],
						'name'  => [ 'type' => 'string' ],
						'roles' => [
							'type'  => 'array',
							'items' => [ 'type' => 'string' ],
						],
					],
				],
				'site'  => [
					'type'       => 'object',
					'properties' => [
						'title' => [ 'type' => 'string' ],
						'url'   => [ 'type' => 'string' ],
					],
				],
				'meta_included' => [ 'type' => 'boolean' ],
			],
		],
		'permission_callback' => function () {
			return current_user_can( 'read' );
		},
		'execute_callback'    => function ( $input ) {
			$user_id      = $input['user_id'];
			$include_meta = isset( $input['include_meta'] ) ? (bool) $input['include_meta'] : false;
			$user         = get_userdata( $user_id );
			$user_name    = $user ? $user->display_name : 'unknown';
			$user_roles   = $user ? array_values( $user->roles ) : [];

			return [
				'user'          => [
					'id'    => $user_id,
					'name'  => $user_name,
					'roles' => $user_roles,
				],
				'site'          => [
					'title' => get_bloginfo( 'name' ),
					'url'   => get_bloginfo( 'url' ),
				],
				'meta_included' => $include_meta,
			];
		},
		'meta'                => [
			'show_in_rest' => true,
			'annotations'  => [
				'readonly'    => true,
				'destructive' => false,
			],
		],
	] );

	// ── Regular ability with complex input schema (POST /run) ─────────────
	wp_register_ability( 'test/process-complex', [
		'label'               => 'Process Complex Data',
		'description'         => 'Processes complex nested input and returns an echo (regular test ability with complex schema).',
		'category'            => 'test',
		'input_schema'        => [
			'type'       => 'object',
			'properties' => [
				'name'     => [ 'type' => 'string' ],
				'settings' => [
					'type'       => 'object',
					'properties' => [
						'theme'     => [ 'type' => 'string' ],
						'font_size' => [ 'type' => 'integer' ],
					],
					'required'   => [ 'theme' ],
				],
				'tags'     => [
					'type'  => 'array',
					'items' => [ 'type' => 'string' ],
				],
			],
			'required'   => [ 'name', 'settings' ],
		],
		'output_schema'       => [
			'type'       => 'object',
			'properties' => [
				'processed' => [ 'type' => 'boolean' ],
				'echo'      => [
					'type'       => 'object',
					'properties' => [
						'name'     => [ 'type' => 'string' ],
						'settings' => [
							'type'       => 'object',
							'properties' => [
								'theme'     => [ 'type' => 'string' ],
								'font_size' => [ 'type' => 'integer' ],
							],
						],
						'tags'     => [
							'type'  => 'array',
							'items' => [ 'type' => 'string' ],
						],
					],
				],
			],
		],
		'permission_callback' => function () {
			return current_user_can( 'manage_options' );
		},
		'execute_callback'    => function ( $input ) {
			return [
				'processed' => true,
				'echo'      => [
					'name'     => $input['name'],
					'settings' => $input['settings'],
					'tags'     => isset( $input['tags'] ) ? $input['tags'] : [],
				],
			];
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
