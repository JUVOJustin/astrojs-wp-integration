<?php
/**
 * Registers integration-test abilities for the WordPress Abilities API.
 */
add_action( 'wp_abilities_api_categories_init', function () {
	if ( ! function_exists( 'wp_register_ability_category' ) ) {
		return;
	}

	wp_register_ability_category( 'test', [
		'label'       => 'Test',
		'description' => 'Integration-test abilities used by the local wp-env suite.',
	] );
} );

add_action( 'wp_abilities_api_init', function () {
	if ( ! function_exists( 'wp_register_ability' ) ) {
		return;
	}

	wp_register_ability( 'test/get-site-title', [
		'label'               => 'Get Site Title',
		'description'         => 'Returns the site title for read-only ability tests.',
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

	wp_register_ability( 'test/update-option', [
		'label'               => 'Update Test Option',
		'description'         => 'Updates the test ability option for POST ability tests.',
		'category'            => 'test',
		'input_schema'        => [
			'type'       => 'object',
			'properties' => [
				'value' => [ 'type' => 'string' ],
				'key'   => [ 'type' => 'string' ],
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
			$option_key = isset( $input['key'] ) && is_string( $input['key'] ) && '' !== $input['key']
				? $input['key']
				: 'test_ability_option';
			$previous = get_option( $option_key, '' );
			update_option( $option_key, $input['value'] );
			return [
				'previous' => $previous,
				'current'  => $input['value'],
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

	wp_register_ability( 'test/get-complex-data', [
		'label'               => 'Get Complex Data',
		'description'         => 'Returns nested data for fluent ability validation tests.',
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
				'user'          => [
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
				'site'          => [
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

	wp_register_ability( 'test/process-complex', [
		'label'               => 'Process Complex Data',
		'description'         => 'Processes nested input for POST ability tests.',
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

	wp_register_ability( 'test/delete-option', [
		'label'               => 'Delete Test Option',
		'description'         => 'Deletes the test ability option for DELETE ability tests.',
		'category'            => 'test',
		'input_schema'        => [
			'type' => 'string',
		],
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
		'execute_callback'    => function ( $input ) {
			$option_key = is_string( $input ) && '' !== $input
				? $input
				: 'test_ability_option';
			$previous = get_option( $option_key, '' );
			delete_option( $option_key );
			return [
				'deleted'  => true,
				'previous' => $previous,
			];
		},
		'meta'                => [
			'show_in_rest' => true,
			'annotations'  => [
				'readonly'    => false,
				'destructive' => true,
				'idempotent'  => true,
			],
		],
	] );
} );
