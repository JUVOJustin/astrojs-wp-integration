<?php
/**
 * Force-enables WordPress application passwords over HTTP.
 *
 * WordPress 6.x requires HTTPS for application passwords by default.
 * This mu-plugin overrides that check so the integration test suite
 * can authenticate against the local wp-env instance running on HTTP.
 */
add_filter( 'wp_is_application_passwords_available', '__return_true' );
