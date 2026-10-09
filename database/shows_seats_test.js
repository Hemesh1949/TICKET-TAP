// Seat Selection, Tier Pricing, 5-Minute Lock & Concurrency Tests (FR-7 to FR-11)
const assert = require('assert');
const { db } = require('../src/config/db');

async function runSeatTests() {
    const baseUrl = 'http://localhost:3000';
    console.log('🎟️ Starting FR-7 to FR-11 Shows & Seat Lock Verification Tests...\n');

    let userACookie = '';
    let userBCookie = '';

    // Helper fetch wrapper
    async function apiFetch(path, options = {}, cookie = '') {
        options.headers = options.headers || {};
        if (cookie) options.headers['cookie'] = cookie;
        options.headers['Content-Type'] = 'application/json';
        const res = await fetch(`${baseUrl}${path}`, options);
        const setCookie = res.headers.get('set-cookie');
        let newCookie = cookie;
        if (setCookie) {
            newCookie = setCookie.split(';')[0];
        }
        const data = await res.json().catch(() => ({}));
        return { status: res.status, data, cookie: newCookie };
    }

    // Authenticate User A (Customer: john.doe@example.com)
    console.log('▶ Setup: Authenticating User A (Customer)...');
    const loginA = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'john.doe@example.com', password: 'User@123' })
    });
    assert.strictEqual(loginA.status, 200);
    userACookie = loginA.cookie;
    console.log('  ✅ User A authenticated.');

    // Authenticate User B (Customer: priya.sharma@example.com)
    console.log('▶ Setup: Authenticating User B (Customer)...');
    const loginB = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'priya.sharma@example.com', password: 'User@123' })
    });
    assert.strictEqual(loginB.status, 200);
    userBCookie = loginB.cookie;
    console.log('  ✅ User B authenticated.');

    // --- TEST 1: FR-7 & FR-8 & FR-11 Seat Layout & Categories ---
    console.log('\n▶ TEST 1: Fetch show details & seat layout with categories (FR-7, FR-8, FR-11)');
    const showId = 2; // Show 2
    const res1 = await apiFetch(`/api/shows/${showId}`, {}, userACookie);
    assert.strictEqual(res1.status, 200);
    assert(res1.data.show.movie_title, 'Show must contain movie title');
    assert(res1.data.categories.Premium, 'Must have Premium category');
    assert(res1.data.categories.Regular, 'Must have Regular category');
    assert(res1.data.categories.Premium.price > res1.data.categories.Regular.price, 'Premium price must be higher than Regular');
    console.log(`  ✅ Show "${res1.data.show.movie_title}" has ${res1.data.totalSeats} seats (Premium: ₹${res1.data.categories.Premium.price}, Regular: ₹${res1.data.categories.Regular.price}).`);

    // Pick 2 available seats from Show 2 for testing
    const seatRows = db.prepare(`
        SELECT ss.id as show_seat_id, ss.seat_id, st.seat_row, st.seat_number, st.category
        FROM show_seats ss
        JOIN seats st ON ss.seat_id = st.id
        WHERE ss.show_id = ? AND ss.status = 'available'
        LIMIT 10
    `).all(showId);

    assert(seatRows.length >= 7, 'Need at least 7 test seats');
    const testSeat1 = seatRows[0].seat_id;
    const testSeat2 = seatRows[1].seat_id;
    const testSeat3 = seatRows[2].seat_id;

    // --- TEST 2: Unauthenticated User Lock Rejection ---
    console.log('▶ TEST 2: Unauthenticated request to lock seats must be rejected (401)');
    const res2 = await apiFetch(`/api/shows/${showId}/lock`, {
        method: 'POST',
        body: JSON.stringify({ seatIds: [testSeat1, testSeat2] })
    }, ''); // No cookie
    assert.strictEqual(res2.status, 401, 'Expected 401 when not logged in');
    console.log('  ✅ Denied seat locking to unauthenticated visitor.');

    // --- TEST 3: FR-8 Maximum 6 Seats Validation ---
    console.log('▶ TEST 3: Attempt to lock 7 seats (violating 6-seat cap - FR-8)');
    const sevenSeats = seatRows.slice(0, 7).map(s => s.seat_id);
    const res3 = await apiFetch(`/api/shows/${showId}/lock`, {
        method: 'POST',
        body: JSON.stringify({ seatIds: sevenSeats })
    }, userACookie);
    assert.strictEqual(res3.status, 400, 'Expected 400 for > 6 seats');
    console.log('  ✅ Rejected request exceeding 6 seats cap.');

    // --- TEST 4: FR-9 5-Minute Seat Lock for User A ---
    console.log('▶ TEST 4: User A locks 2 seats for 5 minutes (FR-9)');
    const res4 = await apiFetch(`/api/shows/${showId}/lock`, {
        method: 'POST',
        body: JSON.stringify({ seatIds: [testSeat1, testSeat2] })
    }, userACookie);
    assert.strictEqual(res4.status, 200, 'Expected 200 on valid lock');
    assert.strictEqual(res4.data.lockedSeats.length, 2);
    assert(res4.data.lockExpiresAt, 'Expected lockExpiresAt timestamp');
    assert.strictEqual(res4.data.expiresInSeconds, 300);
    console.log(`  ✅ User A successfully held 2 seats for 5 minutes (Expires at: ${res4.data.lockExpiresAt}).`);

    // Verify DB state
    const lockedRowA = db.prepare('SELECT status, locked_by_user_id FROM show_seats WHERE show_id = ? AND seat_id = ?').get(showId, testSeat1);
    assert.strictEqual(lockedRowA.status, 'locked');
    assert.strictEqual(lockedRowA.locked_by_user_id, 2); // John Doe

    // --- TEST 5: FR-10 Concurrency & Double Booking Prevention ---
    console.log('▶ TEST 5: User B attempts to lock the SAME seats held by User A (FR-10)');
    const res5 = await apiFetch(`/api/shows/${showId}/lock`, {
        method: 'POST',
        body: JSON.stringify({ seatIds: [testSeat1, testSeat3] })
    }, userBCookie);
    assert.strictEqual(res5.status, 409, 'Expected 409 Conflict when seats locked by someone else');
    console.log('  ✅ Prevented User B from double-locking seats held by User A.');

    // --- TEST 6: User B attempts to lock already Booked Seats (FR-10) ---
    console.log('▶ TEST 6: User B attempts to lock an already booked seat (FR-10)');
    // Show 1 has booked seats A1, A2 from initial seed
    const bookedSeatRow = db.prepare(`SELECT seat_id FROM show_seats WHERE show_id = 1 AND status = 'booked' LIMIT 1`).get();
    if (bookedSeatRow) {
        const res6 = await apiFetch('/api/shows/1/lock', {
            method: 'POST',
            body: JSON.stringify({ seatIds: [bookedSeatRow.seat_id] })
        }, userBCookie);
        assert.strictEqual(res6.status, 409, 'Expected 409 Conflict for booked seat');
        console.log('  ✅ Prevented locking already booked seat.');
    }

    // --- TEST 7: FR-9 Automatic Lock Expiration & Re-acquisition ---
    console.log('▶ TEST 7: Expired lock auto-release and re-acquisition (FR-9)');
    // Manually expire User A's lock by setting locked_until 10 seconds in the past
    const pastDate = new Date(Date.now() - 10000).toISOString();
    db.prepare(`UPDATE show_seats SET locked_until = ? WHERE show_id = ? AND seat_id = ?`).run(pastDate, showId, testSeat1);

    // Now User B tries to lock testSeat1 -> auto-cleanup should release expired lock and grant it to User B
    const res7 = await apiFetch(`/api/shows/${showId}/lock`, {
        method: 'POST',
        body: JSON.stringify({ seatIds: [testSeat1] })
    }, userBCookie);
    assert.strictEqual(res7.status, 200, 'User B should acquire previously expired seat');
    console.log('  ✅ Expired lock auto-released and acquired by User B.');

    // --- TEST 8: User B releases seats manually ---
    console.log('▶ TEST 8: User B manually releases seat lock');
    const res8 = await apiFetch(`/api/shows/${showId}/release`, {
        method: 'POST'
    }, userBCookie);
    assert.strictEqual(res8.status, 200);

    const seatCheck = db.prepare('SELECT status, locked_until FROM show_seats WHERE show_id = ? AND seat_id = ?').get(showId, testSeat1);
    assert.strictEqual(seatCheck.status, 'available');
    assert.strictEqual(seatCheck.locked_until, null);
    console.log('  ✅ Seat reverted to available status upon release.');

    // --- TEST 9: Real-time Status Polling Endpoint ---
    console.log('▶ TEST 9: Real-time seat status endpoint');
    const res9 = await apiFetch(`/api/shows/${showId}/status`);
    assert.strictEqual(res9.status, 200);
    assert(res9.data.seatStatuses, 'Expected seatStatuses map');
    console.log('  ✅ Real-time status map verified.');

    console.log('\n🎉 ALL FR-7 TO FR-11 SEAT & SHOW CONCURRENCY TESTS PASSED!\n');
}

runSeatTests().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
