<?php
/**
 * Normalizes Authorization headers so JWT auth works in local wp-env routing.
 */
if (!function_exists('wp_astro_sync_authorization_header')) {
    /**
     * Copies fallback server header values into the canonical Authorization key.
     */
    function wp_astro_sync_authorization_header(): void
    {
        if (!empty($_SERVER['HTTP_AUTHORIZATION'])) {
            return;
        }

        if (empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
            return;
        }

        $_SERVER['HTTP_AUTHORIZATION'] = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    }

    wp_astro_sync_authorization_header();
}
