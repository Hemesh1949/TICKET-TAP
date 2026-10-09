const { db } = require('../config/db');

// Helper to auto-release expired seat locks across the system
function cleanupExpiredLocks() {
    const nowIso = new Date().toISOString();
    db.prepare(`
        UPDATE show_seats 
        SET status = 'available', locked_until = NULL, locked_by_user_id = NULL
        WHERE status = 'locked' AND locked_until IS NOT NULL AND locked_until < ?
    `).run(nowIso);
}

// 1. Get Show Details & Complete Seat Layout (FR-7, FR-8, FR-11)
exports.getShowSeatLayout = (req, res) => {
    try {
        const { showId } = req.params;
        const currentUserId = req.session?.user?.id || null;

        // Auto-release expired locks first
        cleanupExpiredLocks();

        // 1. Get Show Details
        const show = db.prepare(`
            SELECT 
                s.id AS show_id, s.show_date, s.show_time, s.base_price_regular, s.base_price_premium,
                m.id AS movie_id, m.title AS movie_title, m.poster_url, m.certificate, m.language, m.duration_mins,
                sc.id AS screen_id, sc.screen_number, sc.screen_name, sc.total_seats,
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

        // 2. Query all seats and their current status for this show
        const seatRows = db.prepare(`
            SELECT 
                ss.id AS show_seat_id,
                ss.show_id,
                ss.seat_id,
                ss.status,
                ss.price,
                ss.locked_until,
                ss.locked_by_user_id,
                st.seat_row,
                st.seat_number,
                st.category
            FROM show_seats ss
            JOIN seats st ON ss.seat_id = st.id
            WHERE ss.show_id = ?
            ORDER BY st.seat_row ASC, st.seat_number ASC
        `).all(showId);

        // Group seats by category and row
        const rowsMap = {};
        const categories = {
            Premium: { name: 'Premium', price: show.base_price_premium, rows: [] },
            Regular: { name: 'Regular', price: show.base_price_regular, rows: [] }
        };

        let myActiveLock = null;
        let myLockedSeats = [];

        for (const seat of seatRows) {
            let effectiveStatus = seat.status;

            // Check if locked by this user
            const isLockedByMe = currentUserId && seat.status === 'locked' && seat.locked_by_user_id === currentUserId;
            if (isLockedByMe) {
                effectiveStatus = 'selected_by_me';
                myLockedSeats.push(seat.show_seat_id);
                if (!myActiveLock || new Date(seat.locked_until) > new Date(myActiveLock)) {
                    myActiveLock = seat.locked_until;
                }
            }

            if (!rowsMap[seat.seat_row]) {
                rowsMap[seat.seat_row] = {
                    row: seat.seat_row,
                    category: seat.category,
                    seats: []
                };
            }

            rowsMap[seat.seat_row].seats.push({
                show_seat_id: seat.show_seat_id,
                seat_id: seat.seat_id,
                row: seat.seat_row,
                number: seat.seat_number,
                label: `${seat.seat_row}${seat.seat_number}`,
                category: seat.category,
                price: seat.price,
                status: effectiveStatus,
                isAvailable: effectiveStatus === 'available' || effectiveStatus === 'selected_by_me'
            });
        }

        // Partition rows into Premium & Regular
        for (const rowKey of Object.keys(rowsMap).sort()) {
            const rowData = rowsMap[rowKey];
            if (rowData.category === 'Premium') {
                categories.Premium.rows.push(rowData);
            } else {
                categories.Regular.rows.push(rowData);
            }
        }

        return res.json({
            success: true,
            show,
            categories,
            totalSeats: seatRows.length,
            myLockedSeats,
            lockExpiresAt: myActiveLock,
            currentUserId
        });

    } catch (error) {
        console.error('Error fetching seat layout:', error);
        return res.status(500).json({ error: 'Failed to retrieve seat layout.' });
    }
};

// 2. Lock Seats for 5 Minutes with Database Transaction (FR-9, FR-10, FR-8)
exports.lockSeats = (req, res) => {
    try {
        const { showId } = req.params;
        const { seatIds } = req.body; // Array of seat IDs or show_seat IDs
        const userId = req.session?.user?.id;

        if (!userId) {
            return res.status(401).json({
                error: 'Authentication required. Please sign in to lock seats and proceed to booking.',
                code: 'AUTH_REQUIRED'
            });
        }

        if (!Array.isArray(seatIds) || seatIds.length === 0) {
            return res.status(400).json({ error: 'Please select at least one seat.' });
        }

        // FR-8: Maximum 6 seats per booking
        if (seatIds.length > 6) {
            return res.status(400).json({
                error: 'Maximum 6 seats can be booked in a single transaction.'
            });
        }

        const now = new Date();
        const lockDurationMs = 5 * 60 * 1000; // 5 minutes
        const lockExpiresAt = new Date(now.getTime() + lockDurationMs).toISOString();
        const nowIso = now.toISOString();

        // Run Atomic Database Transaction to prevent race conditions & double bookings (FR-10)
        const lockTransaction = db.transaction(() => {
            // 1. Release expired locks first
            db.prepare(`
                UPDATE show_seats 
                SET status = 'available', locked_until = NULL, locked_by_user_id = NULL
                WHERE status = 'locked' AND locked_until IS NOT NULL AND locked_until < ?
            `).run(nowIso);

            // 2. Query target seats to check availability
            const placeholders = seatIds.map(() => '?').join(',');
            const targetSeats = db.prepare(`
                SELECT ss.id AS show_seat_id, ss.seat_id, ss.status, ss.locked_by_user_id, ss.locked_until, ss.price,
                       st.seat_row, st.seat_number, st.category
                FROM show_seats ss
                JOIN seats st ON ss.seat_id = st.id
                WHERE ss.show_id = ? AND (ss.id IN (${placeholders}) OR ss.seat_id IN (${placeholders}))
            `).all(showId, ...seatIds, ...seatIds);

            if (targetSeats.length !== seatIds.length) {
                throw new Error('ONE_OR_MORE_SEATS_NOT_FOUND');
            }

            // Check if any seat is already booked or locked by another user
            const unavailableSeats = [];
            for (const seat of targetSeats) {
                if (seat.status === 'booked') {
                    unavailableSeats.push(`${seat.seat_row}${seat.seat_number} (Already Booked)`);
                } else if (seat.status === 'locked' && seat.locked_by_user_id !== userId) {
                    unavailableSeats.push(`${seat.seat_row}${seat.seat_number} (Locked by another user)`);
                }
            }

            if (unavailableSeats.length > 0) {
                const err = new Error('SEATS_UNAVAILABLE');
                err.unavailableSeats = unavailableSeats;
                throw err;
            }

            // 3. Release any other seats previously locked by this user for this show
            const targetShowSeatIds = targetSeats.map(s => s.show_seat_id);
            const notInPlaceholders = targetShowSeatIds.map(() => '?').join(',');
            db.prepare(`
                UPDATE show_seats 
                SET status = 'available', locked_until = NULL, locked_by_user_id = NULL
                WHERE show_id = ? AND locked_by_user_id = ? AND status = 'locked' AND id NOT IN (${notInPlaceholders})
            `).run(showId, userId, ...targetShowSeatIds);

            // 4. Lock the selected seats for 5 minutes
            const updateStmt = db.prepare(`
                UPDATE show_seats 
                SET status = 'locked', locked_until = ?, locked_by_user_id = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND (status = 'available' OR locked_by_user_id = ?)
            `);

            for (const seat of targetSeats) {
                const result = updateStmt.run(lockExpiresAt, userId, seat.show_seat_id, userId);
                if (result.changes === 0) {
                    throw new Error('CONCURRENT_LOCK_FAILURE');
                }
            }

            return targetSeats;
        });

        let lockedSeats;
        try {
            lockedSeats = lockTransaction();
        } catch (txError) {
            if (txError.message === 'SEATS_UNAVAILABLE') {
                return res.status(409).json({
                    error: `The following seats are no longer available: ${txError.unavailableSeats.join(', ')}. Please choose other seats.`,
                    unavailableSeats: txError.unavailableSeats,
                    code: 'SEATS_UNAVAILABLE'
                });
            } else if (txError.message === 'CONCURRENT_LOCK_FAILURE') {
                return res.status(409).json({
                    error: 'Another user just selected one of these seats. Please pick different seats.',
                    code: 'CONCURRENT_LOCK_CONFLICT'
                });
            } else {
                console.error('Lock transaction error:', txError);
                return res.status(400).json({ error: 'Failed to lock selected seats. Please try again.' });
            }
        }

        // Calculate subtotal
        const totalBaseAmount = lockedSeats.reduce((sum, s) => sum + s.price, 0);

        return res.json({
            success: true,
            message: `Successfully locked ${lockedSeats.length} seat(s) for 5 minutes.`,
            showId: Number(showId),
            lockedSeats: lockedSeats.map(s => ({
                showSeatId: s.show_seat_id,
                seatId: s.seat_id,
                label: `${s.seat_row}${s.seat_number}`,
                category: s.category,
                price: s.price
            })),
            totalBaseAmount,
            lockExpiresAt,
            expiresInSeconds: 300
        });

    } catch (error) {
        console.error('Error locking seats:', error);
        return res.status(500).json({ error: 'Internal server error while locking seats.' });
    }
};

// 3. Release Locked Seats
exports.releaseSeats = (req, res) => {
    try {
        const { showId } = req.params;
        const userId = req.session?.user?.id;

        if (!userId) {
            return res.status(401).json({ error: 'Authentication required.' });
        }

        const result = db.prepare(`
            UPDATE show_seats 
            SET status = 'available', locked_until = NULL, locked_by_user_id = NULL
            WHERE show_id = ? AND locked_by_user_id = ? AND status = 'locked'
        `).run(showId, userId);

        return res.json({
            success: true,
            message: 'Seats released.',
            releasedCount: result.changes
        });

    } catch (error) {
        console.error('Error releasing seats:', error);
        return res.status(500).json({ error: 'Failed to release seats.' });
    }
};

// 4. Get Live Seat Status for Realtime Polling
exports.getLiveSeatStatus = (req, res) => {
    try {
        const { showId } = req.params;
        const currentUserId = req.session?.user?.id || null;

        cleanupExpiredLocks();

        const seatRows = db.prepare(`
            SELECT id AS show_seat_id, status, locked_by_user_id
            FROM show_seats
            WHERE show_id = ?
        `).all(showId);

        const seatStatuses = {};
        for (const seat of seatRows) {
            let status = seat.status;
            if (status === 'locked' && seat.locked_by_user_id === currentUserId) {
                status = 'selected_by_me';
            }
            seatStatuses[seat.show_seat_id] = status;
        }

        return res.json({
            success: true,
            seatStatuses
        });

    } catch (error) {
        console.error('Error polling seat statuses:', error);
        return res.status(500).json({ error: 'Failed to get live seat status.' });
    }
};
