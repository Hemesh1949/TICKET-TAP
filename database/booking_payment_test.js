// Booking Summary, Coupon Discounts, Payment Simulation & E-Ticket Tests (FR-12 to FR-17)
const assert = require('assert');
const { db } = require('../src/config/db');

async function runBookingPaymentTests() {
    const baseUrl = 'http://localhost:3000';
    console.log('💳 Starting FR-12 to FR-17 Booking, Payment & E-Ticket Tests...\n');

    let userCookie = '';

    // Helper fetch wrapper
    async function apiFetch(path, options = {}) {
        options.headers = options.headers || {};
        if (userCookie) options.headers['cookie'] = userCookie;
        options.headers['Content-Type'] = 'application/json';
        const res = await fetch(`${baseUrl}${path}`, options);
        const setCookie = res.headers.get('set-cookie');
        if (setCookie) {
            userCookie = setCookie.split(';')[0];
        }
        const data = await res.json().catch(() => ({}));
        return { status: res.status, data };
    }

    // Authenticate Customer (John Doe)
    console.log('▶ Setup: Authenticating test customer...');
    const login = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'john.doe@example.com', password: 'User@123' })
    });
    assert.strictEqual(login.status, 200);
    console.log('  ✅ Logged in as John Doe.\n');

    // Use Show 4 for clean test booking
    const showId = 4;
    const availableSeats = db.prepare(`
        SELECT ss.id as show_seat_id, ss.seat_id, ss.price, st.seat_row, st.seat_number, st.category
        FROM show_seats ss
        JOIN seats st ON ss.seat_id = st.id
        WHERE ss.show_id = ? AND ss.status = 'available'
        LIMIT 4
    `).all(showId);

    assert(availableSeats.length >= 4, 'Need at least 4 available test seats');
    const seat1 = availableSeats[0].seat_id;
    const seat2 = availableSeats[1].seat_id;
    const seat3 = availableSeats[2].seat_id;
    const seat4 = availableSeats[3].seat_id;

    // --- TEST 1: FR-12 Booking Summary ---
    console.log('▶ TEST 1: Get booking checkout summary with taxes & totals (FR-12)');
    const res1 = await apiFetch(`/api/bookings/summary?showId=${showId}&seatIds=${seat1},${seat2}`);
    assert.strictEqual(res1.status, 200);
    assert(res1.data.show.movie_title, 'Expected movie title');
    assert.strictEqual(res1.data.seats.length, 2);
    assert(res1.data.pricing.taxAmount > 0, 'Expected 18% GST calculation');
    assert(res1.data.pricing.finalAmount > res1.data.pricing.baseAmount, 'Final must include tax');
    console.log(`  ✅ Summary: Movie="${res1.data.show.movie_title}", Seats=2, Base=₹${res1.data.pricing.baseAmount}, Tax=₹${res1.data.pricing.taxAmount}, Total=₹${res1.data.pricing.finalAmount}`);

    // --- TEST 2: FR-13 Coupon Code Application ---
    console.log('▶ TEST 2: Apply valid percentage coupon WELCOME50 (50% off up to ₹100 - FR-13)');
    const baseAmt = 400.0;
    const res2 = await apiFetch('/api/bookings/apply-coupon', {
        method: 'POST',
        body: JSON.stringify({ code: 'WELCOME50', baseAmount: baseAmt })
    });
    assert.strictEqual(res2.status, 200);
    assert.strictEqual(res2.data.valid, true);
    assert.strictEqual(res2.data.discountAmount, 100, 'WELCOME50 should cap at max ₹100');
    console.log(`  ✅ WELCOME50 applied discount: ₹${res2.data.discountAmount} (Final: ₹${res2.data.finalAmount})`);

    console.log('▶ TEST 3: Apply invalid / nonexistent coupon code (FR-13)');
    const res3 = await apiFetch('/api/bookings/apply-coupon', {
        method: 'POST',
        body: JSON.stringify({ code: 'INVALIDCODE99', baseAmount: baseAmt })
    });
    assert.strictEqual(res3.status, 400);
    assert.strictEqual(res3.data.valid, false);
    console.log('  ✅ Rejected invalid coupon code.');

    // --- TEST 4: FR-14 & FR-15 Simulated Payment Failure ---
    console.log('\n▶ TEST 4: Lock seats and simulate payment FAILURE (FR-14, FR-15)');
    // First lock seat 3
    const lockRes1 = await apiFetch(`/api/shows/${showId}/lock`, {
        method: 'POST',
        body: JSON.stringify({ seatIds: [seat3] })
    });
    assert.strictEqual(lockRes1.status, 200);
    console.log('  ✅ Seat locked for payment simulation.');

    // Submit checkout with failure simulation
    const failCheckout = await apiFetch('/api/bookings/checkout', {
        method: 'POST',
        body: JSON.stringify({
            showId,
            seatIds: [seat3],
            paymentMethod: 'UPI',
            simulateResult: 'failure'
        })
    });
    assert.strictEqual(failCheckout.status, 400);
    assert.strictEqual(failCheckout.data.success, false);
    console.log('  ✅ Payment failed response returned.');

    // Verify seats were released back to 'available'
    const seat3Check = db.prepare('SELECT status, locked_until FROM show_seats WHERE show_id = ? AND seat_id = ?').get(showId, seat3);
    assert.strictEqual(seat3Check.status, 'available');
    assert.strictEqual(seat3Check.locked_until, null);
    console.log('  ✅ Held seat automatically released back to inventory on payment failure.');

    // --- TEST 5: FR-14, FR-15, FR-16, FR-17 Simulated Payment Success ---
    console.log('\n▶ TEST 5: Lock seats, apply coupon, and simulate payment SUCCESS (FR-14, FR-15, FR-16, FR-17)');
    // Lock seat 1 and seat 2
    const lockRes2 = await apiFetch(`/api/shows/${showId}/lock`, {
        method: 'POST',
        body: JSON.stringify({ seatIds: [seat1, seat2] })
    });
    assert.strictEqual(lockRes2.status, 200);

    // Submit checkout with success simulation & coupon
    const successCheckout = await apiFetch('/api/bookings/checkout', {
        method: 'POST',
        body: JSON.stringify({
            showId,
            seatIds: [seat1, seat2],
            couponCode: 'TAP10',
            paymentMethod: 'UPI',
            simulateResult: 'success'
        })
    });

    assert.strictEqual(successCheckout.status, 201);
    assert.strictEqual(successCheckout.data.success, true);
    assert(successCheckout.data.bookingNumber.startsWith('TT-'), 'Expected TT- booking number');
    assert(successCheckout.data.qrCode.startsWith('data:image/png;base64,'), 'Expected QR code base64 image data');
    const createdBookingId = successCheckout.data.bookingId;
    console.log(`  ✅ Booking confirmed! Reference: ${successCheckout.data.bookingNumber} | QR Code generated.`);

    // Verify seats are marked as 'booked' in SQLite
    const seat1Check = db.prepare('SELECT status FROM show_seats WHERE show_id = ? AND seat_id = ?').get(showId, seat1);
    const seat2Check = db.prepare('SELECT status FROM show_seats WHERE show_id = ? AND seat_id = ?').get(showId, seat2);
    assert.strictEqual(seat1Check.status, 'booked');
    assert.strictEqual(seat2Check.status, 'booked');
    console.log('  ✅ Verified both seats marked as "booked" in database.');

    // Verify Payment record in SQLite
    const paymentRow = db.prepare('SELECT * FROM payments WHERE booking_id = ?').get(createdBookingId);
    assert.strictEqual(paymentRow.status, 'success');
    assert.strictEqual(paymentRow.payment_method, 'UPI');
    console.log(`  ✅ Payment record verified (Txn: ${paymentRow.transaction_id}, Amount: ₹${paymentRow.amount}).`);

    // --- TEST 6: FR-16 & FR-17 E-Ticket Details ---
    console.log('\n▶ TEST 6: Fetch E-Ticket by Booking ID (FR-16, FR-17)');
    const ticketRes = await apiFetch(`/api/bookings/${createdBookingId}`);
    assert.strictEqual(ticketRes.status, 200);
    assert.strictEqual(ticketRes.data.booking.bookingNumber, successCheckout.data.bookingNumber);
    assert.strictEqual(ticketRes.data.seats.length, 2);
    assert(ticketRes.data.booking.qrCode, 'Ticket must contain QR Code');
    assert(ticketRes.data.show.movie_title, 'Ticket must contain movie title');
    assert(ticketRes.data.show.theatre_name, 'Ticket must contain cinema name');
    console.log(`  ✅ E-Ticket verified for "${ticketRes.data.show.movie_title}" at ${ticketRes.data.show.theatre_name}.`);

    console.log('\n🎉 ALL FR-12 TO FR-17 BOOKING & PAYMENT TESTS PASSED SUCCESSFULLY!\n');
}

runBookingPaymentTests().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
