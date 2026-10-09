const crypto = require('crypto');
const QRCode = require('qrcode');
const { db } = require('../config/db');

// Helper to calculate pricing
function calculatePricing(baseAmount, coupon = null) {
    let discountAmount = 0;
    let couponId = null;

    if (coupon) {
        couponId = coupon.id;
        if (coupon.discount_type === 'percentage') {
            discountAmount = (baseAmount * coupon.discount_value) / 100;
            if (coupon.max_discount && discountAmount > coupon.max_discount) {
                discountAmount = coupon.max_discount;
            }
        } else if (coupon.discount_type === 'fixed') {
            discountAmount = Math.min(coupon.discount_value, baseAmount);
        }
    }

    discountAmount = Number(discountAmount.toFixed(2));
    const discountedBase = Math.max(0, baseAmount - discountAmount);
    const taxAmount = Number((discountedBase * 0.18).toFixed(2)); // 18% GST
    const finalAmount = Number((discountedBase + taxAmount).toFixed(2));

    return {
        baseAmount,
        discountAmount,
        discountedBase,
        taxAmount,
        finalAmount,
        couponId
    };
}

// 1. Get Booking Checkout Summary (FR-12)
exports.getCheckoutSummary = (req, res) => {
    try {
        const { showId, seatIds } = req.query;
        const userId = req.session?.user?.id;

        if (!showId || !seatIds) {
            return res.status(400).json({ error: 'showId and seatIds parameters are required.' });
        }

        const seatIdList = Array.isArray(seatIds) 
            ? seatIds.map(Number) 
            : String(seatIds).split(',').map(Number);

        // Fetch show details
        const show = db.prepare(`
            SELECT 
                s.id AS show_id, s.show_date, s.show_time, s.base_price_regular, s.base_price_premium,
                m.id AS movie_id, m.title AS movie_title, m.poster_url, m.certificate, m.language, m.duration_mins,
                sc.id AS screen_id, sc.screen_name,
                t.id AS theatre_id, t.name AS theatre_name, t.city AS theatre_city, t.location AS theatre_location
            FROM shows s
            JOIN movies m ON s.movie_id = m.id
            JOIN screens sc ON s.screen_id = sc.id
            JOIN theatres t ON sc.theatre_id = t.id
            WHERE s.id = ?
        `).get(showId);

        if (!show) {
            return res.status(404).json({ error: 'Show not found.' });
        }

        // Fetch seats details
        const placeholders = seatIdList.map(() => '?').join(',');
        const seats = db.prepare(`
            SELECT ss.id AS show_seat_id, ss.seat_id, ss.price, ss.status, ss.locked_by_user_id,
                   st.seat_row, st.seat_number, st.category
            FROM show_seats ss
            JOIN seats st ON ss.seat_id = st.id
            WHERE ss.show_id = ? AND (ss.seat_id IN (${placeholders}) OR ss.id IN (${placeholders}))
        `).all(showId, ...seatIdList, ...seatIdList);

        if (seats.length === 0) {
            return res.status(404).json({ error: 'No valid seats found for this show.' });
        }

        const baseAmount = seats.reduce((sum, s) => sum + s.price, 0);
        const pricing = calculatePricing(baseAmount);

        return res.json({
            success: true,
            show,
            seats: seats.map(s => ({
                showSeatId: s.show_seat_id,
                seatId: s.seat_id,
                label: `${s.seat_row}${s.seat_number}`,
                category: s.category,
                price: s.price,
                status: s.status,
                isLockedByMe: userId ? s.locked_by_user_id === userId : false
            })),
            pricing
        });

    } catch (error) {
        console.error('Error fetching checkout summary:', error);
        return res.status(500).json({ error: 'Failed to retrieve booking summary.' });
    }
};

// 2. Validate & Apply Coupon Code (FR-13)
exports.applyCoupon = (req, res) => {
    try {
        const { code, baseAmount } = req.body;

        if (!code || baseAmount === undefined) {
            return res.status(400).json({ error: 'Coupon code and base amount are required.' });
        }

        const cleanCode = String(code).trim().toUpperCase();
        const amount = Number(baseAmount);

        // Lookup coupon
        const coupon = db.prepare(`
            SELECT * FROM coupons 
            WHERE UPPER(code) = ? AND is_active = 1
        `).get(cleanCode);

        if (!coupon) {
            return res.status(400).json({ 
                valid: false, 
                error: 'Invalid coupon code.' 
            });
        }

        const today = new Date().toISOString().split('T')[0];
        if (coupon.valid_from > today || coupon.valid_until < today) {
            return res.status(400).json({ 
                valid: false, 
                error: 'This coupon code has expired or is not yet active.' 
            });
        }

        if (coupon.min_booking_amount && amount < coupon.min_booking_amount) {
            return res.status(400).json({ 
                valid: false, 
                error: `This coupon requires a minimum booking amount of ₹${coupon.min_booking_amount}.` 
            });
        }

        const pricing = calculatePricing(amount, coupon);

        return res.json({
            valid: true,
            coupon: {
                id: coupon.id,
                code: coupon.code,
                discountType: coupon.discount_type,
                discountValue: coupon.discount_value,
                maxDiscount: coupon.max_discount
            },
            ...pricing,
            message: `Coupon "${coupon.code}" applied! You saved ₹${pricing.discountAmount}.`
        });

    } catch (error) {
        console.error('Error applying coupon:', error);
        return res.status(500).json({ error: 'Failed to validate coupon code.' });
    }
};

// 3. Process Simulated Payment & Confirm Booking (FR-14, FR-15, FR-16, FR-17)
exports.processCheckout = async (req, res) => {
    try {
        const { showId, seatIds, couponCode, paymentMethod = 'UPI', simulateResult = 'success' } = req.body;
        const user = req.session?.user;

        if (!user) {
            return res.status(401).json({ error: 'Authentication required. Please log in.' });
        }

        if (!showId || !Array.isArray(seatIds) || seatIds.length === 0) {
            return res.status(400).json({ error: 'Valid showId and seatIds are required.' });
        }

        const seatIdList = seatIds.map(Number);
        const placeholders = seatIdList.map(() => '?').join(',');

        // 1. Fetch Show and User's Locked Seats
        const show = db.prepare(`
            SELECT 
                s.id AS show_id, s.show_date, s.show_time,
                m.title AS movie_title, m.poster_url, m.certificate, m.language,
                sc.screen_name,
                t.name AS theatre_name, t.city AS theatre_city, t.location AS theatre_location
            FROM shows s
            JOIN movies m ON s.movie_id = m.id
            JOIN screens sc ON s.screen_id = sc.id
            JOIN theatres t ON sc.theatre_id = t.id
            WHERE s.id = ?
        `).get(showId);

        if (!show) {
            return res.status(404).json({ error: 'Show not found.' });
        }

        const targetSeats = db.prepare(`
            SELECT ss.id AS show_seat_id, ss.seat_id, ss.price, ss.status, ss.locked_by_user_id, ss.locked_until,
                   st.seat_row, st.seat_number, st.category
            FROM show_seats ss
            JOIN seats st ON ss.seat_id = st.id
            WHERE ss.show_id = ? AND (ss.seat_id IN (${placeholders}) OR ss.id IN (${placeholders}))
        `).all(showId, ...seatIdList, ...seatIdList);

        if (targetSeats.length !== seatIdList.length) {
            return res.status(400).json({ error: 'One or more selected seats could not be found.' });
        }

        // Verify that current user holds the lock on ALL these seats
        const unheldSeats = targetSeats.filter(s => s.locked_by_user_id !== user.id || s.status !== 'locked');
        if (unheldSeats.length > 0) {
            return res.status(409).json({
                error: 'Your 5-minute seat hold has expired or seats were released. Please re-select your seats.',
                code: 'SEAT_LOCK_EXPIRED'
            });
        }

        // --- SIMULATE PAYMENT FAILURE CASE (FR-15) ---
        if (simulateResult === 'failure') {
            // Release the seats immediately on failure so user or others can re-select
            const showSeatIds = targetSeats.map(s => s.show_seat_id);
            const releasePlaceholders = showSeatIds.map(() => '?').join(',');
            db.prepare(`
                UPDATE show_seats 
                SET status = 'available', locked_until = NULL, locked_by_user_id = NULL
                WHERE id IN (${releasePlaceholders}) AND locked_by_user_id = ?
            `).run(...showSeatIds, user.id);

            return res.status(400).json({
                success: false,
                paymentStatus: 'failed',
                error: 'Payment failed (Simulated transaction decline). Your held seats have been released.',
                canRetry: true
            });
        }

        // --- SIMULATE PAYMENT SUCCESS CASE (FR-15, FR-16, FR-17) ---
        // Validate coupon if provided
        let coupon = null;
        if (couponCode) {
            coupon = db.prepare(`
                SELECT * FROM coupons 
                WHERE UPPER(code) = ? AND is_active = 1
            `).get(String(couponCode).trim().toUpperCase());
        }

        const baseAmount = targetSeats.reduce((sum, s) => sum + s.price, 0);
        const pricing = calculatePricing(baseAmount, coupon);

        // Generate Unique Booking Reference: TT-YYYYMMDD-XXXXXX
        const dateTag = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
        const bookingNumber = `TT-${dateTag}-${randomHex}`;

        const seatLabels = targetSeats.map(s => `${s.seat_row}${s.seat_number}`);

        // Generate QR Code Payload & Data URL (FR-16)
        const qrPayload = {
            app: 'Ticket Tap',
            bookingNumber,
            user: user.name,
            movie: show.movie_title,
            theatre: show.theatre_name,
            screen: show.screen_name,
            showDate: show.show_date,
            showTime: show.show_time,
            seats: seatLabels,
            amountPaid: pricing.finalAmount,
            verified: true
        };

        const qrCodeDataUrl = await QRCode.toDataURL(JSON.stringify(qrPayload), {
            width: 250,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#ffffff'
            }
        });

        // Atomic Transaction to Confirm Booking and Mark Seats Booked
        const bookingTransaction = db.transaction(() => {
            // 1. Insert Booking Record
            const insertBookingStmt = db.prepare(`
                INSERT INTO bookings (
                    booking_number, user_id, show_id, total_amount, discount_amount,
                    tax_amount, final_amount, status, coupon_id, qr_code_data
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?)
            `);

            const bookingResult = insertBookingStmt.run(
                bookingNumber,
                user.id,
                showId,
                pricing.baseAmount,
                pricing.discountAmount,
                pricing.taxAmount,
                pricing.finalAmount,
                pricing.couponId,
                qrCodeDataUrl
            );

            const bookingId = bookingResult.lastInsertRowid;

            // 2. Insert Booking Seats & Mark Show Seats as 'booked' (FR-15)
            const insertBookingSeatStmt = db.prepare(`
                INSERT INTO booking_seats (booking_id, show_seat_id, seat_id, price)
                VALUES (?, ?, ?, ?)
            `);

            const markBookedStmt = db.prepare(`
                UPDATE show_seats 
                SET status = 'booked', locked_until = NULL, locked_by_user_id = NULL, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `);

            for (const seat of targetSeats) {
                insertBookingSeatStmt.run(bookingId, seat.show_seat_id, seat.seat_id, seat.price);
                markBookedStmt.run(seat.show_seat_id);
            }

            // 3. Record Successful Payment
            const txnId = `TXN_${paymentMethod.toUpperCase().replace(/\s+/g, '')}_${Date.now()}`;
            const insertPaymentStmt = db.prepare(`
                INSERT INTO payments (
                    booking_id, user_id, payment_method, transaction_id, amount, status
                ) VALUES (?, ?, ?, ?, ?, 'success')
            `);

            insertPaymentStmt.run(bookingId, user.id, paymentMethod, txnId, pricing.finalAmount);

            return { bookingId, txnId };
        });

        const txResult = bookingTransaction();

        // 4. Log Simulated Confirmation Email (FR-17)
        console.log('\n===============================================================');
        console.log('📧 [SIMULATED EMAIL NOTIFICATION - BOOKING CONFIRMED]');
        console.log(`To: ${user.name} <${user.email}>`);
        console.log(`Subject: Your Ticket Tap Booking Confirmation #${bookingNumber}`);
        console.log(`Movie: ${show.movie_title} (${show.language}) | Certificate: ${show.certificate}`);
        console.log(`Cinema: ${show.theatre_name} - ${show.screen_name}`);
        console.log(`Date & Time: ${show.show_date} at ${show.show_time}`);
        console.log(`Seats: ${seatLabels.join(', ')}`);
        console.log(`Total Amount Paid: ₹${pricing.finalAmount} via ${paymentMethod}`);
        console.log(`Payment Transaction ID: ${txResult.txnId}`);
        console.log('===============================================================\n');

        return res.status(201).json({
            success: true,
            message: 'Booking confirmed! Your e-ticket is ready.',
            bookingId: txResult.bookingId,
            bookingNumber,
            qrCode: qrCodeDataUrl,
            bookingDetails: {
                bookingId: txResult.bookingId,
                bookingNumber,
                movieTitle: show.movie_title,
                theatreName: show.theatre_name,
                screenName: show.screen_name,
                showDate: show.show_date,
                showTime: show.show_time,
                seats: seatLabels,
                totalAmount: pricing.baseAmount,
                discountAmount: pricing.discountAmount,
                taxAmount: pricing.taxAmount,
                finalAmount: pricing.finalAmount,
                paymentMethod,
                transactionId: txResult.txnId
            }
        });

    } catch (error) {
        console.error('Checkout error:', error);
        return res.status(500).json({ error: 'Internal server error processing checkout.' });
    }
};

// 4. Get E-Ticket & Booking Details by ID or Booking Number (FR-16, FR-17)
exports.getBookingDetails = (req, res) => {
    try {
        const { identifier } = req.params;
        const currentUserId = req.session?.user?.id;
        const currentUserRole = req.session?.user?.role;

        let booking;
        if (!isNaN(identifier)) {
            booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(identifier);
        } else {
            booking = db.prepare('SELECT * FROM bookings WHERE booking_number = ?').get(identifier);
        }

        if (!booking) {
            return res.status(404).json({ error: 'Booking not found.' });
        }

        // Customer can only view their own bookings, admin can view all
        if (currentUserId && currentUserRole !== 'admin' && booking.user_id !== currentUserId) {
            return res.status(403).json({ error: 'Access denied to this booking.' });
        }

        // Fetch user info
        const user = db.prepare('SELECT id, name, email, mobile FROM users WHERE id = ?').get(booking.user_id);

        // Fetch show & movie info
        const show = db.prepare(`
            SELECT 
                s.id AS show_id, s.show_date, s.show_time,
                m.id AS movie_id, m.title AS movie_title, m.poster_url, m.banner_url, m.certificate, m.language, m.duration_mins, m.genre,
                sc.id AS screen_id, sc.screen_name,
                t.id AS theatre_id, t.name AS theatre_name, t.city AS theatre_city, t.location AS theatre_location
            FROM shows s
            JOIN movies m ON s.movie_id = m.id
            JOIN screens sc ON s.screen_id = sc.id
            JOIN theatres t ON sc.theatre_id = t.id
            WHERE s.id = ?
        `).get(booking.show_id);

        // Fetch booked seats
        const bookedSeats = db.prepare(`
            SELECT bs.price, st.seat_row, st.seat_number, st.category
            FROM booking_seats bs
            JOIN seats st ON bs.seat_id = st.id
            WHERE bs.booking_id = ?
            ORDER BY st.seat_row ASC, st.seat_number ASC
        `).all(booking.id);

        // Fetch payment details
        const payment = db.prepare('SELECT * FROM payments WHERE booking_id = ?').get(booking.id);

        // Fetch applied coupon if any
        let coupon = null;
        if (booking.coupon_id) {
            coupon = db.prepare('SELECT code, discount_type, discount_value FROM coupons WHERE id = ?').get(booking.coupon_id);
        }

        return res.json({
            success: true,
            booking: {
                id: booking.id,
                bookingNumber: booking.booking_number,
                status: booking.status,
                totalAmount: booking.total_amount,
                discountAmount: booking.discount_amount,
                taxAmount: booking.tax_amount,
                finalAmount: booking.final_amount,
                qrCode: booking.qr_code_data,
                createdAt: booking.created_at
            },
            user,
            show,
            seats: bookedSeats.map(s => ({
                label: `${s.seat_row}${s.seat_number}`,
                row: s.seat_row,
                number: s.seat_number,
                category: s.category,
                price: s.price
            })),
            payment,
            coupon
        });

    } catch (error) {
        console.error('Error fetching booking details:', error);
        return res.status(500).json({ error: 'Failed to retrieve booking information.' });
    }
};
