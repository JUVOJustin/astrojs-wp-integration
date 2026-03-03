<?php
/**
 * Generates deterministic seed data for integration tests.
 *
 * Run via: npx wp-env run cli -- wp eval-file wp-content/seed-content.php
 *
 * Creates:
 *  - 5 categories (Technology, Science, Travel, Food, Health)
 *  - 8 tags (featured, trending, tutorial, review, guide, news, opinion, update)
 *  - 150 posts ("Test Post 001" – "Test Post 150"), 30 per category
 *  - 10 pages (About, Contact, Services, FAQ, Team, Blog, Portfolio, Testimonials, Privacy Policy, Terms of Service)
 *  - 10 books ("Test Book 001" – "Test Book 010") — custom post type registered by mu-plugin
 *
 * Deletes the default "Hello world!" post, "Sample Page", and auto-draft
 * content so the DB starts clean.
 */

/* ------------------------------------------------------------------ */
/* Clean default content                                              */
/* ------------------------------------------------------------------ */

$default_post = get_page_by_path( 'hello-world', OBJECT, 'post' );
if ( $default_post ) {
	wp_delete_post( $default_post->ID, true );
}

$default_page = get_page_by_path( 'sample-page', OBJECT, 'page' );
if ( $default_page ) {
	wp_delete_post( $default_page->ID, true );
}

// Remove auto-drafts
$auto_drafts = get_posts([
	'post_status' => 'auto-draft',
	'post_type'   => 'any',
	'numberposts' => -1,
]);
foreach ( $auto_drafts as $draft ) {
	wp_delete_post( $draft->ID, true );
}

/* ------------------------------------------------------------------ */
/* Categories                                                         */
/* ------------------------------------------------------------------ */

$category_names = [ 'Technology', 'Science', 'Travel', 'Food', 'Health' ];
$category_ids   = [];

foreach ( $category_names as $name ) {
	$slug = sanitize_title( $name );
	$existing = get_term_by( 'slug', $slug, 'category' );

	if ( $existing ) {
		$category_ids[ $slug ] = $existing->term_id;
		continue;
	}

	$result = wp_insert_term( $name, 'category', [
		'slug'        => $slug,
		'description' => "Integration test category: $name",
	]);

	if ( is_wp_error( $result ) ) {
		WP_CLI::error( "Failed to create category '$name': " . $result->get_error_message() );
	}

	$category_ids[ $slug ] = $result['term_id'];
}

WP_CLI::success( 'Categories created: ' . implode( ', ', array_keys( $category_ids ) ) );

/* ------------------------------------------------------------------ */
/* Tags                                                               */
/* ------------------------------------------------------------------ */

$tag_names = [ 'featured', 'trending', 'tutorial', 'review', 'guide', 'news', 'opinion', 'update' ];
$tag_ids   = [];

foreach ( $tag_names as $name ) {
	$slug = sanitize_title( $name );
	$existing = get_term_by( 'slug', $slug, 'post_tag' );

	if ( $existing ) {
		$tag_ids[ $slug ] = $existing->term_id;
		continue;
	}

	$result = wp_insert_term( ucfirst( $name ), 'post_tag', [
		'slug'        => $slug,
		'description' => "Integration test tag: $name",
	]);

	if ( is_wp_error( $result ) ) {
		WP_CLI::error( "Failed to create tag '$name': " . $result->get_error_message() );
	}

	$tag_ids[ $slug ] = $result['term_id'];
}

WP_CLI::success( 'Tags created: ' . implode( ', ', array_keys( $tag_ids ) ) );

/* ------------------------------------------------------------------ */
/* Posts — 150 total, 30 per category                                 */
/* ------------------------------------------------------------------ */

$category_slugs = array_keys( $category_ids );

// Tag assignment per category group
$tag_assignments = [
	[ 'featured', 'tutorial' ],  // Technology  (1-30)
	[ 'trending', 'news' ],      // Science     (31-60)
	[ 'guide', 'review' ],       // Travel      (61-90)
	[ 'opinion', 'update' ],     // Food        (91-120)
	[ 'featured', 'news' ],      // Health      (121-150)
];

$post_count = 0;

for ( $i = 1; $i <= 150; $i++ ) {
	$padded   = str_pad( $i, 3, '0', STR_PAD_LEFT );
	$slug     = "test-post-$padded";
	$existing = get_page_by_path( $slug, OBJECT, 'post' );

	if ( $existing ) {
		$post_count++;
		continue;
	}

	// Determine category group (0-based index)
	$group_index = intdiv( $i - 1, 30 );
	$cat_slug    = $category_slugs[ $group_index ];
	$cat_id      = $category_ids[ $cat_slug ];
	$assigned_tags = $tag_assignments[ $group_index ];

	$post_id = wp_insert_post([
		'post_title'   => "Test Post $padded",
		'post_name'    => $slug,
		'post_content' => "<!-- wp:paragraph -->\n<p>Content for test post $padded in category $cat_slug. This is deterministic seed data for integration testing.</p>\n<!-- /wp:paragraph -->",
		'post_excerpt' => "Excerpt for test post $padded",
		'post_status'  => 'publish',
		'post_type'    => 'post',
		'post_date'    => gmdate( 'Y-m-d H:i:s', strtotime( "2025-01-01 +{$i} hours" ) ),
	], true );

	if ( is_wp_error( $post_id ) ) {
		WP_CLI::warning( "Failed to create post $padded: " . $post_id->get_error_message() );
		continue;
	}

	// Assign category (replaces default "Uncategorized")
	wp_set_post_categories( $post_id, [ $cat_id ] );

	// Assign tags
	$tag_id_list = array_map( fn( $t ) => $tag_ids[ $t ], $assigned_tags );
	wp_set_post_tags( $post_id, $tag_id_list );

	$post_count++;
}

WP_CLI::success( "Posts created/verified: $post_count" );

/* ------------------------------------------------------------------ */
/* Pages                                                              */
/* ------------------------------------------------------------------ */

$page_definitions = [
	[ 'title' => 'About',           'slug' => 'about',           'content' => 'Learn more about our organization and mission.' ],
	[ 'title' => 'Contact',         'slug' => 'contact',         'content' => 'Get in touch with us through our contact form.' ],
	[ 'title' => 'Services',        'slug' => 'services',        'content' => 'Explore the services we offer to our clients.' ],
	[ 'title' => 'FAQ',             'slug' => 'faq',             'content' => 'Frequently asked questions and their answers.' ],
	[ 'title' => 'Team',            'slug' => 'team',            'content' => 'Meet the people behind the project.' ],
	[ 'title' => 'Blog',            'slug' => 'blog',            'content' => 'Our latest articles and updates.' ],
	[ 'title' => 'Portfolio',       'slug' => 'portfolio',       'content' => 'A showcase of our recent work and projects.' ],
	[ 'title' => 'Testimonials',    'slug' => 'testimonials',    'content' => 'What our clients say about working with us.' ],
	[ 'title' => 'Privacy Policy',  'slug' => 'privacy-policy',  'content' => 'How we handle and protect your personal data.' ],
	[ 'title' => 'Terms of Service','slug' => 'terms-of-service','content' => 'The terms and conditions for using our services.' ],
];

$page_count = 0;

foreach ( $page_definitions as $index => $def ) {
	$existing = get_page_by_path( $def['slug'], OBJECT, 'page' );

	if ( $existing ) {
		// Ensure pre-existing pages (e.g. WP's default Privacy Policy draft) are published
		if ( $existing->post_status !== 'publish' ) {
			wp_update_post([
				'ID'          => $existing->ID,
				'post_status' => 'publish',
				'post_content' => "<!-- wp:paragraph -->\n<p>{$def['content']}</p>\n<!-- /wp:paragraph -->",
				'menu_order'  => $index + 1,
			]);
		}
		$page_count++;
		continue;
	}

	$page_id = wp_insert_post([
		'post_title'   => $def['title'],
		'post_name'    => $def['slug'],
		'post_content' => "<!-- wp:paragraph -->\n<p>{$def['content']}</p>\n<!-- /wp:paragraph -->",
		'post_status'  => 'publish',
		'post_type'    => 'page',
		'menu_order'   => $index + 1,
		'post_date'    => gmdate( 'Y-m-d H:i:s', strtotime( "2025-01-01 +{$index} hours" ) ),
	], true );

	if ( is_wp_error( $page_id ) ) {
		WP_CLI::warning( "Failed to create page '{$def['title']}': " . $page_id->get_error_message() );
		continue;
	}

	$page_count++;
}

WP_CLI::success( "Pages created/verified: $page_count" );

/* ------------------------------------------------------------------ */
/* Books (custom post type)                                           */
/* ------------------------------------------------------------------ */

$book_count = 0;

for ( $i = 1; $i <= 10; $i++ ) {
	$padded   = str_pad( $i, 3, '0', STR_PAD_LEFT );
	$slug     = "test-book-$padded";
	$existing = get_page_by_path( $slug, OBJECT, 'book' );

	if ( $existing ) {
		$book_count++;
		continue;
	}

	$book_id = wp_insert_post([
		'post_title'   => "Test Book $padded",
		'post_name'    => $slug,
		'post_content' => "<!-- wp:paragraph -->\n<p>Content for test book $padded. This is deterministic seed data for CPT integration testing.</p>\n<!-- /wp:paragraph -->",
		'post_excerpt' => "Excerpt for test book $padded",
		'post_status'  => 'publish',
		'post_type'    => 'book',
		'post_date'    => gmdate( 'Y-m-d H:i:s', strtotime( "2025-01-01 +{$i} hours" ) ),
	], true );

	if ( is_wp_error( $book_id ) ) {
		WP_CLI::warning( "Failed to create book $padded: " . $book_id->get_error_message() );
		continue;
	}

	$book_count++;
}

WP_CLI::success( "Books created/verified: $book_count" );

/* ------------------------------------------------------------------ */
/* Native WordPress Meta Fields                                       */
/* ------------------------------------------------------------------ */

/**
 * Seeds deterministic native WordPress meta values for key entries.
 *
 * Values are always upserted so repeated runs stay in sync with tests.
 */
$seed_native_meta = function ( int $post_id, array $meta ): void {
	foreach ( $meta as $key => $value ) {
		update_post_meta( $post_id, $key, $value );
	}
};

$native_meta_targets = [
	[
		'post_type' => 'post',
		'slug'      => 'test-post-001',
		'meta'      => [
			'test_string_meta' => 'Seed string meta for test-post-001',
			'test_number_meta' => 11.5,
			'test_array_meta'  => [ 'seed-post-001-a', 'seed-post-001-b' ],
		],
	],
	[
		'post_type' => 'page',
		'slug'      => 'about',
		'meta'      => [
			'test_string_meta' => 'Seed string meta for about-page',
			'test_number_meta' => 21.5,
			'test_array_meta'  => [ 'seed-about-a', 'seed-about-b' ],
		],
	],
	[
		'post_type' => 'book',
		'slug'      => 'test-book-001',
		'meta'      => [
			'test_string_meta' => 'Seed string meta for test-book-001',
			'test_number_meta' => 31.5,
			'test_array_meta'  => [ 'seed-book-001-a', 'seed-book-001-b' ],
			'test_book_isbn'   => '978-0-11-111111-1',
		],
	],
];

$native_meta_seeded = 0;

foreach ( $native_meta_targets as $target ) {
	$post = get_page_by_path( $target['slug'], OBJECT, $target['post_type'] );

	if ( ! $post ) {
		WP_CLI::warning( "{$target['post_type']} '{$target['slug']}' not found — skipping native meta seeding." );
		continue;
	}

	$seed_native_meta( $post->ID, $target['meta'] );
	$native_meta_seeded++;
}

WP_CLI::success( "Native meta seeded for entries: $native_meta_seeded" );

/* ------------------------------------------------------------------ */
/* ACF Fields                                                         */
/* ------------------------------------------------------------------ */
/* Always runs (not skipped on existing content) so that values stay  */
/* in sync with what the tests expect after `wp-env start`.           */

if ( ! function_exists( 'update_field' ) ) {
	WP_CLI::warning( 'ACF is not active — skipping ACF field seeding.' );
} else {

	// Posts 1–3: full set of scalar fields, plus relationship and featured post.
	for ( $i = 1; $i <= 3; $i++ ) {
		$padded = str_pad( $i, 3, '0', STR_PAD_LEFT );
		$post   = get_page_by_path( "test-post-$padded", OBJECT, 'post' );

		if ( ! $post ) {
			WP_CLI::warning( "Post test-post-$padded not found — skipping ACF seeding." );
			continue;
		}

		// Related posts: the next two posts in sequence
		$rel_ids = [];
		for ( $j = $i + 1; $j <= $i + 2 && $j <= 150; $j++ ) {
			$rp = get_page_by_path( 'test-post-' . str_pad( $j, 3, '0', STR_PAD_LEFT ), OBJECT, 'post' );
			if ( $rp ) {
				$rel_ids[] = $rp->ID;
			}
		}

		// Featured post: ten positions ahead
		$featured = get_page_by_path( 'test-post-' . str_pad( $i + 10, 3, '0', STR_PAD_LEFT ), OBJECT, 'post' );

		update_field( 'acf_subtitle',       "Subtitle for test post $padded",                                   $post->ID );
		update_field( 'acf_summary',        "Summary content for test post $padded. Deterministic seed data.",  $post->ID );
		update_field( 'acf_priority_score', $i * 10,                                                            $post->ID );
		update_field( 'acf_external_url',   "https://example.com/test-post-$padded",                           $post->ID );

		if ( ! empty( $rel_ids ) ) {
			update_field( 'acf_related_posts', $rel_ids, $post->ID );
		}

		if ( $featured ) {
			update_field( 'acf_featured_post', $featured->ID, $post->ID );
		}
	}

	// Pages: about (priority 20) and contact (priority 40).
	$page_acf = [
		'about'   => [ 'subtitle' => 'Subtitle for about page',   'priority' => 20, 'url' => 'https://example.com/about' ],
		'contact' => [ 'subtitle' => 'Subtitle for contact page', 'priority' => 40, 'url' => 'https://example.com/contact' ],
	];

	foreach ( $page_acf as $slug => $fields ) {
		$page = get_page_by_path( $slug, OBJECT, 'page' );
		if ( ! $page ) {
			continue;
		}

		// Relate each page to test-post-001 and test-post-002
		$rel_post_1 = get_page_by_path( 'test-post-001', OBJECT, 'post' );
		$rel_post_2 = get_page_by_path( 'test-post-002', OBJECT, 'post' );
		$page_rels  = array_values( array_filter( [
			$rel_post_1 ? $rel_post_1->ID : null,
			$rel_post_2 ? $rel_post_2->ID : null,
		] ) );

		update_field( 'acf_subtitle',       $fields['subtitle'],                                          $page->ID );
		update_field( 'acf_summary',        "Summary for the $slug page. Deterministic seed data.",       $page->ID );
		update_field( 'acf_priority_score', $fields['priority'],                                          $page->ID );
		update_field( 'acf_external_url',   $fields['url'],                                               $page->ID );

		if ( ! empty( $page_rels ) ) {
			update_field( 'acf_related_posts', $page_rels, $page->ID );
		}
	}

	// Books 1–2: scalar fields plus a featured post reference.
	for ( $i = 1; $i <= 2; $i++ ) {
		$padded  = str_pad( $i, 3, '0', STR_PAD_LEFT );
		$book    = get_page_by_path( "test-book-$padded", OBJECT, 'book' );

		if ( ! $book ) {
			continue;
		}

		$featured = get_page_by_path( 'test-post-' . str_pad( $i * 5, 3, '0', STR_PAD_LEFT ), OBJECT, 'post' );

		update_field( 'acf_subtitle',       "Subtitle for test book $padded",                                  $book->ID );
		update_field( 'acf_summary',        "Summary for test book $padded. Deterministic seed data.",         $book->ID );
		update_field( 'acf_priority_score', $i * 15,                                                           $book->ID );

		if ( $featured ) {
			update_field( 'acf_featured_post', $featured->ID, $book->ID );
		}
	}

	WP_CLI::success( 'ACF fields seeded.' );
}

/* ------------------------------------------------------------------ */
/* Summary                                                            */
/* ------------------------------------------------------------------ */

WP_CLI::success( 'Seed data generation complete.' );
WP_CLI::log( "  Categories: " . count( $category_ids ) );
WP_CLI::log( "  Tags:       " . count( $tag_ids ) );
WP_CLI::log( "  Posts:      $post_count" );
WP_CLI::log( "  Pages:      $page_count" );
WP_CLI::log( "  Books:      $book_count" );
WP_CLI::log( "  Native meta seeded entries: $native_meta_seeded" );
