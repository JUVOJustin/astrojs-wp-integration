<?php
/**
 * Registers a custom REST API endpoint that exposes ACF field choices.
 *
 * ACF's native REST API schema exposes select / radio / checkbox values as
 * plain enums but does not include the human-readable labels. This endpoint
 * reads the live ACF field definitions and returns the value → label
 * mappings so consumers can map raw values to display labels without
 * maintaining hard-coded catalog data on the client side.
 *
 * Endpoint: GET /wp-json/wp-astrojs-integration/v1/acf-choices
 */
add_action( 'rest_api_init', function () {
	if ( ! function_exists( 'acf_get_field_groups' ) ) {
		return;
	}

	register_rest_route(
		'wp-astrojs-integration/v1',
		'/acf-choices',
		[
			'methods'             => 'GET',
			'callback'            => function () {
				$field_groups = acf_get_field_groups();
				$choices      = [];

				foreach ( $field_groups as $group ) {
					$fields = acf_get_fields( $group['key'] );
					if ( ! $fields ) {
						continue;
					}

					foreach ( $fields as $field ) {
						if ( empty( $field['choices'] ) ) {
							continue;
						}

						$field_choices = [];
						foreach ( $field['choices'] as $value => $label ) {
							$field_choices[] = [
								'value' => $value,
								'label' => $label,
							];
						}

						$choices[ $field['name'] ] = $field_choices;
					}
				}

				return $choices;
			},
			'permission_callback' => '__return_true',
		]
	);
} );
