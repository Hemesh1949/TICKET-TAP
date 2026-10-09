/**
 * Ticket Tap - Movie Details & Show Selection Script (FR-6)
 */

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const movieId = urlParams.get('id');

    const heroSection = document.getElementById('details-hero-section');
    const showsSection = document.getElementById('shows-container');
    const dateSelector = document.getElementById('details-date-selector');
    const selectedDateLabel = document.getElementById('selected-date-label');

    if (!movieId) {
        window.location.href = '/';
        return;
    }

    let movieData = null;
    let selectedDate = '';

    // 1. Fetch Movie Details & Available Shows
    try {
        const res = await fetch(`/api/movies/${movieId}`);
        const data = await res.json();

        if (!res.ok || !data.success || !data.movie) {
            heroSection.innerHTML = `
                <div style="text-align:center; padding: 5rem 1rem;">
                    <h2>Movie Not Found</h2>
                    <p style="color: var(--text-secondary); margin: 1rem 0 2rem;">The movie you requested could not be found.</p>
                    <a href="/" class="btn btn-primary">Back to Home</a>
                </div>
            `;
            return;
        }

        movieData = data;
        renderMovieDetails(data.movie);
        renderDateSelector(data.availableDates, data.showsByDate);

    } catch (err) {
        console.error('Error fetching movie details:', err);
        heroSection.innerHTML = `
            <div style="text-align:center; padding: 5rem 1rem;">
                <h2>Error Loading Movie</h2>
                <p style="color: var(--text-secondary); margin: 1rem 0 2rem;">Unable to connect to server.</p>
                <a href="/" class="btn btn-secondary">Return Home</a>
            </div>
        `;
    }

    // 2. Render Movie Information
    function renderMovieDetails(movie) {
        document.title = `${movie.title} - Ticket Tap`;

        const backdropUrl = movie.banner_url || movie.poster_url;
        heroSection.style.backgroundImage = `url('${backdropUrl}')`;

        const durationFormatted = formatDuration(movie.duration_mins);
        const ratingDisplay = movie.rating ? `⭐ ${movie.rating.toFixed(1)} / 10` : '⭐ Not Rated';
        const isNowShowing = movie.status === 'now_showing';

        heroSection.innerHTML = `
            <div class="details-hero-overlay">
                <div class="details-hero-container">
                    <div class="details-poster-box">
                        <img 
                            src="${escapeHtml(movie.poster_url)}" 
                            alt="${escapeHtml(movie.title)}" 
                            class="details-poster-img"
                            onerror="this.src='https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&q=80'"
                        >
                    </div>

                    <div class="details-content">
                        <span class="status-ribbon ${isNowShowing ? 'ribbon-now' : 'ribbon-upcoming'}" style="position: static; display: inline-block; margin-bottom: 0.75rem;">
                            ${isNowShowing ? 'Now Showing' : 'Upcoming Release'}
                        </span>
                        
                        <h1 class="details-title">${escapeHtml(movie.title)}</h1>

                        <div class="details-badges">
                            <span class="badge-item badge-rating">${ratingDisplay}</span>
                            <span class="badge-item">${escapeHtml(movie.certificate)}</span>
                            <span class="badge-item">${escapeHtml(movie.language)}</span>
                            <span class="badge-item">⏱️ ${durationFormatted}</span>
                            <span class="badge-item">📅 Released: ${movie.release_date}</span>
                        </div>

                        <p class="details-synopsis">${escapeHtml(movie.synopsis)}</p>

                        <div class="details-meta-grid">
                            <div>
                                <div class="meta-item-label">Director</div>
                                <div class="meta-item-val">${escapeHtml(movie.director)}</div>
                            </div>
                            <div>
                                <div class="meta-item-label">Starring Cast</div>
                                <div class="meta-item-val">${escapeHtml(movie.cast)}</div>
                            </div>
                            <div>
                                <div class="meta-item-label">Genre</div>
                                <div class="meta-item-val">${escapeHtml(movie.genre)}</div>
                            </div>
                        </div>

                        <div class="details-actions">
                            ${isNowShowing ? `
                                <a href="#shows-section" class="btn btn-primary" id="scroll-shows-btn">
                                    🎟️ Book Tickets
                                </a>
                            ` : `
                                <button class="btn btn-secondary" disabled>
                                    📢 Advance Bookings Opening Soon
                                </button>
                            `}

                            ${movie.trailer_url ? `
                                <button type="button" class="btn btn-secondary" id="watch-trailer-btn">
                                    ▶ Watch Official Trailer
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Attach trailer handler
        document.getElementById('watch-trailer-btn')?.addEventListener('click', () => {
            openTrailerModal(movie.trailer_url, movie.title);
        });

        // Smooth scroll to shows
        document.getElementById('scroll-shows-btn')?.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('shows-section')?.scrollIntoView({ behavior: 'smooth' });
        });
    }

    // 3. Render Date Selector
    function renderDateSelector(availableDates, showsByDate) {
        if (!availableDates || availableDates.length === 0) {
            document.getElementById('shows-section').style.display = 'block';
            showsSection.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🗓️</div>
                    <h3>No Scheduled Shows Available</h3>
                    <p style="color: var(--text-secondary); margin-top: 0.5rem;">
                        There are currently no active screenings for this title. Please check back soon!
                    </p>
                </div>
            `;
            return;
        }

        document.getElementById('shows-section').style.display = 'block';
        selectedDate = availableDates[0];

        dateSelector.innerHTML = availableDates.map((dateStr, idx) => {
            const dateObj = new Date(dateStr);
            const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
            const dayNumber = dateObj.toLocaleDateString('en-US', { day: '2-digit' });
            const monthName = dateObj.toLocaleDateString('en-US', { month: 'short' });

            return `
                <button 
                    type="button" 
                    class="date-chip ${idx === 0 ? 'active' : ''}" 
                    data-date="${dateStr}"
                    style="padding: 0.6rem 1.2rem; text-align: center;"
                >
                    <div style="font-size: 0.75rem; text-transform: uppercase;">${dayName}</div>
                    <div style="font-size: 1.1rem; font-weight: 800; color: #fff;">${dayNumber}</div>
                    <div style="font-size: 0.75rem; text-transform: uppercase;">${monthName}</div>
                </button>
            `;
        }).join('');

        // Date chip click events
        dateSelector.querySelectorAll('.date-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                dateSelector.querySelectorAll('.date-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                selectedDate = chip.dataset.date;
                renderShowsForDate(showsByDate[selectedDate]);
            });
        });

        // Render first available date shows
        renderShowsForDate(showsByDate[selectedDate]);
    }

    // 4. Render Shows for Selected Date
    function renderShowsForDate(theatresMap) {
        if (selectedDateLabel) {
            const d = new Date(selectedDate);
            selectedDateLabel.textContent = d.toLocaleDateString('en-US', { 
                weekday: 'long', 
                day: 'numeric', 
                month: 'long', 
                year: 'numeric' 
            });
        }

        if (!theatresMap || Object.keys(theatresMap).length === 0) {
            showsSection.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🎬</div>
                    <h3>No shows on this date</h3>
                    <p style="color: var(--text-secondary);">Please choose another date above to view screenings.</p>
                </div>
            `;
            return;
        }

        const theatreCardsHtml = Object.values(theatresMap).map(theatre => {
            const showsHtml = theatre.shows.map(s => {
                return `
                    <a href="/booking.html?showId=${s.show_id}" class="show-timing-btn" title="Regular: ₹${s.base_price_regular} | Premium: ₹${s.base_price_premium}">
                        <span class="timing-time">${s.show_time}</span>
                        <span class="timing-screen">${escapeHtml(s.screen_name)}</span>
                        <span class="timing-price">From ₹${s.base_price_regular}</span>
                    </a>
                `;
            }).join('');

            return `
                <div class="theatre-card">
                    <div class="theatre-info">
                        <div>
                            <h3 class="theatre-name">🏛️ ${escapeHtml(theatre.theatre_name)}</h3>
                            <div class="theatre-loc">📍 ${escapeHtml(theatre.theatre_location)}, ${escapeHtml(theatre.theatre_city)}</div>
                        </div>
                        <div class="badge-item" style="font-size: 0.8rem;">
                            Dolby Atmos & 4K Laser
                        </div>
                    </div>
                    <div class="shows-grid">
                        ${showsHtml}
                    </div>
                </div>
            `;
        }).join('');

        showsSection.innerHTML = theatreCardsHtml;
    }

    // Modal Trailer Player
    function openTrailerModal(url, title) {
        let embedUrl = url;
        if (url.includes('youtube.com/watch?v=')) {
            const videoId = url.split('v=')[1]?.split('&')[0];
            embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
        } else if (url.includes('youtu.be/')) {
            const videoId = url.split('youtu.be/')[1]?.split('?')[0];
            embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
        }

        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.id = 'trailer-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3 style="font-family: var(--font-heading); font-size: 1.2rem;">${escapeHtml(title)} – Official Trailer</h3>
                    <button class="modal-close-btn" onclick="document.getElementById('trailer-modal').remove()">✕</button>
                </div>
                <div class="video-container">
                    <iframe src="${embedUrl}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
                </div>
            </div>
        `;

        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });

        document.body.appendChild(modal);
    }

    // Utilities
    function formatDuration(mins) {
        if (!mins) return 'N/A';
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return `${h}h ${m}m`;
    }

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
});
