/**
 * Ticket Tap - Seat Selection & 5-Minute Lock Controller (FR-7 to FR-11)
 */

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const showId = urlParams.get('showId');

    if (!showId) {
        window.location.href = '/';
        return;
    }

    // State
    const state = {
        showId: Number(showId),
        show: null,
        categories: null,
        selectedSeats: new Map(), // seat_id -> { showSeatId, label, category, price }
        lockedSeats: [],
        lockExpiresAt: null,
        timerInterval: null,
        currentUser: null,
        isLocked: false
    };

    // DOM Elements
    const movieMetaBox = document.getElementById('movie-meta-box');
    const seatMapContainer = document.getElementById('seat-map-container');
    const selectedChipsBox = document.getElementById('selected-seats-chips');
    const selectedCountBadge = document.getElementById('selected-count-badge');
    const baseAmountLabel = document.getElementById('base-amount-label');
    const taxAmountLabel = document.getElementById('tax-amount-label');
    const totalAmountLabel = document.getElementById('total-amount-label');
    const lockTimerBox = document.getElementById('lock-timer-box');
    const timerDigits = document.getElementById('timer-digits');
    const proceedBtn = document.getElementById('proceed-btn');
    const alertBox = document.getElementById('alert-box');

    // 1. Initial Load
    await checkUserSession();
    await loadSeatLayout();
    startStatusPolling();

    async function checkUserSession() {
        try {
            const res = await fetch('/api/auth/me');
            const data = await res.json();
            if (data.authenticated && data.user) {
                state.currentUser = data.user;
            }
        } catch (err) {
            console.error('Session error:', err);
        }
    }

    // 2. Load Show & Seat Layout (FR-7, FR-8, FR-11)
    async function loadSeatLayout() {
        try {
            const res = await fetch(`/api/shows/${state.showId}`);
            const data = await res.json();

            if (!res.ok || !data.success || !data.show) {
                seatMapContainer.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">⚠️</div>
                        <h3>Screening Not Found</h3>
                        <p style="color: var(--text-secondary); margin: 1rem 0;">The requested show is no longer available.</p>
                        <a href="/" class="btn btn-primary">Browse Other Movies</a>
                    </div>
                `;
                return;
            }

            state.show = data.show;
            state.categories = data.categories;

            renderHeaderMeta(data.show);
            renderSeatLayout(data.categories);

            // If user already had active locked seats on this show
            if (data.lockExpiresAt && data.myLockedSeats.length > 0) {
                state.isLocked = true;
                state.lockExpiresAt = new Date(data.lockExpiresAt);
                startLockTimer();
            }

            updateSummary();

        } catch (err) {
            console.error('Failed to load seat layout:', err);
            showAlert('Failed to connect to the server. Please try again.', 'danger');
        }
    }

    // 3. Render Header Information
    function renderHeaderMeta(show) {
        document.title = `Select Seats - ${show.movie_title} | Ticket Tap`;

        const dateObj = new Date(show.show_date);
        const formattedDate = dateObj.toLocaleDateString('en-US', { 
            weekday: 'short', 
            day: 'numeric', 
            month: 'short' 
        });

        movieMetaBox.innerHTML = `
            <div class="booking-movie-meta">
                <img src="${escapeHtml(show.poster_url)}" alt="${escapeHtml(show.movie_title)}" class="meta-poster">
                <div>
                    <h1 class="meta-title">${escapeHtml(show.movie_title)}</h1>
                    <div class="meta-sub">
                        <span>🏛️ ${escapeHtml(show.theatre_name)} (${escapeHtml(show.screen_name)})</span>
                        <span>•</span>
                        <span>📅 ${formattedDate} at <strong>${show.show_time}</strong></span>
                        <span>•</span>
                        <span>🗣️ ${escapeHtml(show.language)}</span>
                        <span>•</span>
                        <span>${escapeHtml(show.certificate)}</span>
                    </div>
                </div>
            </div>
        `;
    }

    // 4. Render Seat Map with Colors & Categories (FR-8, FR-11)
    function renderSeatLayout(categories) {
        let html = '';

        // Premium Category Block
        if (categories.Premium && categories.Premium.rows.length > 0) {
            html += `
                <div class="category-block cat-premium">
                    <div class="category-header">
                        <span class="category-title">👑 Premium Class</span>
                        <span class="category-price-tag">₹${categories.Premium.price}</span>
                    </div>
                    ${renderRows(categories.Premium.rows)}
                </div>
            `;
        }

        // Regular Category Block
        if (categories.Regular && categories.Regular.rows.length > 0) {
            html += `
                <div class="category-block cat-regular">
                    <div class="category-header">
                        <span class="category-title">🎟️ Regular Class</span>
                        <span class="category-price-tag">₹${categories.Regular.price}</span>
                    </div>
                    ${renderRows(categories.Regular.rows)}
                </div>
            `;
        }

        seatMapContainer.innerHTML = html;

        // Attach click listeners to seat buttons
        seatMapContainer.querySelectorAll('.seat-btn').forEach(btn => {
            btn.addEventListener('click', () => handleSeatClick(btn));
        });
    }

    function renderRows(rows) {
        return rows.map(r => {
            const seatsHtml = r.seats.map(s => {
                let statusClass = 'seat-available';
                let isDisabled = false;

                if (s.status === 'booked') {
                    statusClass = 'seat-booked';
                    isDisabled = true;
                } else if (s.status === 'locked') {
                    statusClass = 'seat-locked';
                    isDisabled = true;
                } else if (s.status === 'selected_by_me') {
                    statusClass = 'seat-selected';
                    state.selectedSeats.set(s.seat_id, {
                        showSeatId: s.show_seat_id,
                        seatId: s.seat_id,
                        label: s.label,
                        category: s.category,
                        price: s.price
                    });
                }

                return `
                    <button 
                        type="button" 
                        class="seat-btn ${statusClass}" 
                        data-seat-id="${s.seat_id}"
                        data-show-seat-id="${s.show_seat_id}"
                        data-label="${s.label}"
                        data-category="${s.category}"
                        data-price="${s.price}"
                        data-status="${s.status}"
                        title="Seat ${s.label} (${s.category}) - ₹${s.price}"
                        ${isDisabled ? 'disabled' : ''}
                    >
                        ${s.number}
                    </button>
                `;
            }).join('');

            return `
                <div class="seat-row-container">
                    <span class="row-label">${r.row}</span>
                    <div class="seats-in-row">
                        ${seatsHtml}
                    </div>
                    <span class="row-label">${r.row}</span>
                </div>
            `;
        }).join('');
    }

    // 5. Seat Click Handler (FR-8: max 6 seats)
    function handleSeatClick(btn) {
        const seatId = Number(btn.dataset.seatId);
        const showSeatId = Number(btn.dataset.showSeatId);
        const label = btn.dataset.label;
        const category = btn.dataset.category;
        const price = Number(btn.dataset.price);

        if (btn.classList.contains('seat-booked') || btn.classList.contains('seat-locked')) {
            return;
        }

        // Toggle Selection
        if (state.selectedSeats.has(seatId)) {
            // Deselect
            state.selectedSeats.delete(seatId);
            btn.classList.remove('seat-selected');
            btn.classList.add('seat-available');
        } else {
            // Check maximum 6 seats limit (FR-8)
            if (state.selectedSeats.size >= 6) {
                showAlert('You can select a maximum of 6 seats per booking.', 'warning');
                return;
            }

            state.selectedSeats.set(seatId, { showSeatId, seatId, label, category, price });
            btn.classList.remove('seat-available');
            btn.classList.add('seat-selected');
            hideAlert();
        }

        updateSummary();
    }

    // 6. Update Summary Sidebar
    function updateSummary() {
        const selectedList = Array.from(state.selectedSeats.values());
        const count = selectedList.length;

        selectedCountBadge.textContent = `${count} / 6`;

        if (count === 0) {
            selectedChipsBox.innerHTML = `<span style="font-size: 0.8rem; color: var(--text-muted);">No seats chosen</span>`;
            baseAmountLabel.textContent = '₹0.00';
            taxAmountLabel.textContent = '₹0.00';
            totalAmountLabel.textContent = '₹0.00';
            proceedBtn.disabled = true;
            proceedBtn.textContent = 'Select Seats to Proceed';
            return;
        }

        // Render chips
        selectedChipsBox.innerHTML = selectedList.map(s => `
            <span class="seat-chip">
                <span>${s.label}</span>
                <span style="font-size: 0.7rem; color: #60a5fa;">(${s.category})</span>
            </span>
        `).join('');

        const baseTotal = selectedList.reduce((sum, s) => sum + s.price, 0);
        const taxes = Number((baseTotal * 0.18).toFixed(2)); // 18% GST simulated
        const grandTotal = (baseTotal + taxes).toFixed(2);

        baseAmountLabel.textContent = `₹${baseTotal.toFixed(2)}`;
        taxAmountLabel.textContent = `₹${taxes.toFixed(2)}`;
        totalAmountLabel.textContent = `₹${grandTotal}`;

        proceedBtn.disabled = false;
        proceedBtn.textContent = state.isLocked ? 'Proceed to Payment →' : `Lock ${count} Seat(s) & Pay →`;
    }

    // 7. Lock Seats Action (FR-9, FR-10)
    proceedBtn.addEventListener('click', async () => {
        if (state.selectedSeats.size === 0) return;

        // Verify login
        if (!state.currentUser) {
            const redirectUrl = encodeURIComponent(window.location.href);
            showAlert('Please sign in to lock your seats and proceed with booking.', 'info');
            setTimeout(() => {
                window.location.href = `/login.html?redirect=${redirectUrl}`;
            }, 1000);
            return;
        }

        proceedBtn.disabled = true;
        proceedBtn.textContent = 'Locking selected seats...';

        const seatIds = Array.from(state.selectedSeats.values()).map(s => s.seatId);

        try {
            const res = await fetch(`/api/shows/${state.showId}/lock`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ seatIds })
            });

            const data = await res.json();

            if (!res.ok) {
                showAlert(data.error || 'Failed to lock seats. Someone else may have just selected them.', 'danger');
                proceedBtn.disabled = false;
                await loadSeatLayout();
            // Seats locked successfully!
            state.isLocked = true;
            state.lockExpiresAt = new Date(data.lockExpiresAt);
            showAlert(`Seats locked! Redirecting to payment...`, 'success');
            startLockTimer();
            updateSummary();

            setTimeout(() => {
                const seatIdsCsv = seatIds.join(',');
                window.location.href = `/payment.html?showId=${state.showId}&seatIds=${seatIdsCsv}`;
            }, 600);
            console.error('Seat lock error:', err);
            showAlert('Connection error while locking seats.', 'danger');
            proceedBtn.disabled = false;
        }
    });

    // 8. Countdown Timer (5 Minutes - FR-9)
    function startLockTimer() {
        if (state.timerInterval) clearInterval(state.timerInterval);
        lockTimerBox.classList.remove('d-none');

        function tick() {
            const now = new Date();
            const diffMs = state.lockExpiresAt - now;

            if (diffMs <= 0) {
                clearInterval(state.timerInterval);
                lockTimerBox.classList.add('d-none');
                state.isLocked = false;
                state.selectedSeats.clear();
                showAlert('Your 5-minute seat lock has expired and the seats have been released.', 'warning');
                loadSeatLayout();
                return;
            }

            const totalSecs = Math.floor(diffMs / 1000);
            const mins = Math.floor(totalSecs / 60);
            const secs = totalSecs % 60;
            timerDigits.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }

        tick();
        state.timerInterval = setInterval(tick, 1000);
    }

    // 9. Real-time Status Polling
    function startStatusPolling() {
        setInterval(async () => {
            if (!state.showId) return;
            try {
                const res = await fetch(`/api/shows/${state.showId}/status`);
                const data = await res.json();
                if (data.success && data.seatStatuses) {
                    updateSeatStatusClasses(data.seatStatuses);
                }
            } catch (err) {
                // Background polling error ignored
            }
        }, 8000);
    }

    function updateSeatStatusClasses(statuses) {
        seatMapContainer.querySelectorAll('.seat-btn').forEach(btn => {
            const showSeatId = btn.dataset.showSeatId;
            const newStatus = statuses[showSeatId];
            const seatId = Number(btn.dataset.seatId);

            if (newStatus === 'booked') {
                btn.className = 'seat-btn seat-booked';
                btn.disabled = true;
                if (state.selectedSeats.has(seatId)) {
                    state.selectedSeats.delete(seatId);
                    updateSummary();
                    showAlert(`Seat ${btn.dataset.label} was just booked by another user.`, 'warning');
                }
            } else if (newStatus === 'locked' && !state.selectedSeats.has(seatId)) {
                btn.className = 'seat-btn seat-locked';
                btn.disabled = true;
            } else if (newStatus === 'available' && !state.selectedSeats.has(seatId)) {
                btn.className = 'seat-btn seat-available';
                btn.disabled = false;
            }
        });
    }

    // Utilities
    function showAlert(msg, type = 'danger') {
        alertBox.className = `alert alert-${type}`;
        alertBox.innerHTML = `<span>${type === 'danger' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️'}</span><div>${escapeHtml(msg)}</div>`;
        alertBox.classList.remove('d-none');
    }

    function hideAlert() {
        alertBox.classList.add('d-none');
        alertBox.innerHTML = '';
    }

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
});
