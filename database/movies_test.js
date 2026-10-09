// Movie Catalog & Details Verification Tests (FR-4, FR-5, FR-6)
const assert = require('assert');

async function runMovieTests() {
    const baseUrl = 'http://localhost:3000';
    console.log('🎬 Starting FR-4, FR-5, FR-6 Movie & Show Verification Tests...\n');

    async function apiFetch(path) {
        const res = await fetch(`${baseUrl}${path}`);
        const data = await res.json().catch(() => ({}));
        return { status: res.status, data };
    }

    // --- TEST 1: FR-4 Listing Now Showing & Upcoming ---
    console.log('▶ TEST 1: Fetch all movies');
    const res1 = await apiFetch('/api/movies');
    assert.strictEqual(res1.status, 200);
    assert(res1.data.count >= 10, 'Expected at least 10 movies');
    console.log(`  ✅ Loaded ${res1.data.count} movies.`);

    console.log('▶ TEST 2: Filter by Now Showing status (FR-4)');
    const res2 = await apiFetch('/api/movies?status=now_showing');
    assert.strictEqual(res2.status, 200);
    assert(res2.data.movies.every(m => m.status === 'now_showing'));
    console.log(`  ✅ Verified ${res2.data.count} Now Showing movies.`);

    console.log('▶ TEST 3: Filter by Upcoming status (FR-4)');
    const res3 = await apiFetch('/api/movies?status=upcoming');
    assert.strictEqual(res3.status, 200);
    assert(res3.data.movies.every(m => m.status === 'upcoming'));
    console.log(`  ✅ Verified ${res3.data.count} Upcoming movies.`);

    // --- TEST 4: FR-5 Search by Title ---
    console.log('▶ TEST 4: Search movies by title (FR-5)');
    const res4 = await apiFetch('/api/movies?search=Interstellar');
    assert.strictEqual(res4.status, 200);
    assert(res4.data.movies.some(m => m.title.includes('Interstellar')));
    console.log('  ✅ Search by title returned expected result.');

    // --- TEST 5: FR-5 Filters (Language & Genre) ---
    console.log('▶ TEST 5: Filter movies by language (FR-5)');
    const res5 = await apiFetch('/api/movies?language=Tamil');
    assert.strictEqual(res5.status, 200);
    assert(res5.data.movies.every(m => m.language.toLowerCase() === 'tamil'));
    console.log(`  ✅ Language filter (Tamil) returned ${res5.data.count} movies.`);

    console.log('▶ TEST 6: Filter movies by genre (FR-5)');
    const res6 = await apiFetch('/api/movies?genre=Sci-Fi');
    assert.strictEqual(res6.status, 200);
    assert(res6.data.movies.every(m => m.genre.toLowerCase().includes('sci-fi')));
    console.log(`  ✅ Genre filter (Sci-Fi) returned ${res6.data.count} movies.`);

    // --- TEST 7: FR-5 Filter Options Endpoint ---
    console.log('▶ TEST 7: Fetch dynamic filter options (FR-5)');
    const res7 = await apiFetch('/api/movies/filters');
    assert.strictEqual(res7.status, 200);
    assert(res7.data.languages.length > 0, 'Expected distinct languages');
    assert(res7.data.genres.length > 0, 'Expected distinct genres');
    assert(res7.data.dates.length > 0, 'Expected distinct show dates');
    console.log(`  ✅ Loaded ${res7.data.languages.length} languages, ${res7.data.genres.length} genres, and ${res7.data.dates.length} show dates.`);

    // --- TEST 8: FR-5 Filter by Show Date ---
    const testDate = res7.data.dates[0];
    console.log(`▶ TEST 8: Filter movies by show date (${testDate})`);
    const res8 = await apiFetch(`/api/movies?date=${testDate}`);
    assert.strictEqual(res8.status, 200);
    assert(res8.data.count > 0, 'Expected movies with shows on date');
    console.log(`  ✅ Date filter (${testDate}) returned ${res8.data.count} movies with scheduled shows.`);

    // --- TEST 9: FR-6 Movie Details with Shows ---
    console.log('▶ TEST 9: Fetch movie details and available shows (FR-6)');
    const res9 = await apiFetch('/api/movies/1');
    assert.strictEqual(res9.status, 200);
    const movie = res9.data.movie;
    assert(movie.title, 'Movie must have title');
    assert(movie.synopsis, 'Movie must have synopsis');
    assert(movie.cast, 'Movie must have cast');
    assert(movie.director, 'Movie must have director');
    assert(movie.duration_mins, 'Movie must have duration');
    assert(movie.certificate, 'Movie must have certificate');
    assert(movie.trailer_url, 'Movie must have trailer URL');
    assert(res9.data.availableDates.length > 0, 'Expected available dates for shows');
    assert(Object.keys(res9.data.showsByDate).length > 0, 'Expected shows grouped by date and theatre');
    console.log(`  ✅ Movie 1: "${movie.title}" duration=${movie.duration_mins}m cert=${movie.certificate} trailer=${movie.trailer_url}`);
    console.log(`  ✅ Shows available on ${res9.data.availableDates.length} distinct dates.`);

    console.log('\n🎉 ALL FR-4, FR-5, FR-6 MOVIE TESTS PASSED SUCCESSFULLY!\n');
}

runMovieTests().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
