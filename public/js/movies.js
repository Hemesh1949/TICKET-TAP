/**
 * Ticket Tap - Home Page Movies Catalog Script (FR-4, FR-5)
 */

document.addEventListener('DOMContentLoaded', () => {
    // State management
    const state = {
        status: 'now_showing', // 'now_showing' | 'upcoming' | 'all'
        search: '',
        language: 'all',
        genre: 'all',
        date: '',
        allMovies: []
    };

    // DOM Elements
    const moviesGrid = document.getElementById('movies-grid');
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search-btn');
    const langSelect = document.getElementById('language-filter');
    const genreSelect = document.getElementById('genre-filter');
    const dateChipContainer = document.getElementById('date-chips');
    const resetFiltersBtn = document.getElementById('reset-filters-btn');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const nowShowingCount = document.getElementById('count-now-showing');
    const upcomingCount = document.getElementById('count-upcoming');

    // Initialize Page
    async function init() {
        await loadFilterOptions();
        await fetchAndRenderMovies();
    }

    // 1. Load Filter Dropdowns & Date Chips
    async function loadFilterOptions() {
        try {
            const res = await fetch('/api/movies/filters');
            const data = await res.json();

            if (!data.success) return;

            // Populate Languages
            if (langSelect) {
                data.languages.forEach(lang => {
                    const opt = document.createElement('option');
                    opt.value = lang;
                    opt.textContent = lang;
                    langSelect.appendChild(opt);
                });
            }

            // Populate Genres
            if (genreSelect) {
                data.genres.forEach(genre => {
                    const opt = document.createElement('option');
                    opt.value = genre;
                    opt.textContent = genre;
                    genreSelect.appendChild(opt);
                });
            }

            // Populate Date Chips
            if (dateChipContainer && data.dates.length > 0) {
                dateChipContainer.innerHTML = `
                    <button type="button" class="date-chip active" data-date="">All Dates</button>
                `;

                data.dates.forEach(d => {
                    const dateObj = new Date(d);
                    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                    const dayNum = dateObj.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
                    
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'date-chip';
                    btn.dataset.date = d;
                    btn.textContent = `${dayName}, ${dayNum}`;
                    dateChipContainer.appendChild(btn);
                });

                // Attach date chip listeners
                dateChipContainer.querySelectorAll('.date-chip').forEach(chip => {
                    chip.addEventListener('click', () => {
                        dateChipContainer.querySelectorAll('.date-chip').forEach(c => c.classList.remove('active'));
                        chip.classList.add('active');
                        state.date = chip.dataset.date;
                        fetchAndRenderMovies();
                    });
                });
            }

        } catch (err) {
            console.error('Failed to load filter options:', err);
        }
    }

    // 2. Fetch and Render Movies
    async function fetchAndRenderMovies() {
        moviesGrid.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⏳</div>
                <h3>Loading movies...</h3>
            </div>
        `;

        try {
            const params = new URLSearchParams();
            if (state.status) params.set('status', state.status);
            if (state.search) params.set('search', state.search);
            if (state.language && state.language !== 'all') params.set('language', state.language);
            if (state.genre && state.genre !== 'all') params.set('genre', state.genre);
            if (state.date) params.set('date', state.date);

            const res = await fetch(`/api/movies?${params.toString()}`);
            const data = await res.json();

            if (!data.success || !data.movies) {
                renderEmpty('Unable to load movies. Please try again.');
                return;
            }

            renderMovies(data.movies);
            updateFeaturedHero(data.movies);
            updateCounts();

        } catch (err) {
            console.error('Error fetching movies:', err);
            renderEmpty('Network error while loading movies.');
        }
    }

    // 3. Render Movie Cards (FR-4)
    function renderMovies(movies) {
        if (movies.length === 0) {
            renderEmpty('No movies found matching your search and filter criteria.');
            return;
        }

        moviesGrid.innerHTML = movies.map(m => {
            const isNowShowing = m.status === 'now_showing';
            const durationFormatted = formatDuration(m.duration_mins);
            const ratingDisplay = m.rating ? `⭐ ${m.rating.toFixed(1)}` : '⭐ N/A';

            return `
                <a href="/movie.html?id=${m.id}" class="movie-card" data-id="${m.id}">
                    <div class="poster-box">
                        <img 
                            src="${escapeHtml(m.poster_url)}" 
                            alt="${escapeHtml(m.title)}" 
                            class="poster-img"
                            loading="lazy"
                            onerror="this.src='https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&q=80'"
                        >
                        <div class="poster-overlay"></div>
                        <span class="rating-badge">${ratingDisplay}</span>
                        <span class="cert-badge">${escapeHtml(m.certificate)}</span>
                        <span class="status-ribbon ${isNowShowing ? 'ribbon-now' : 'ribbon-upcoming'}">
                            ${isNowShowing ? 'Now Showing' : 'Upcoming'}
                        </span>
                    </div>

                    <div class="movie-card-body">
                        <h3 class="movie-card-title">${escapeHtml(m.title)}</h3>
                        <div class="movie-card-tags">
                            <span class="tag-lang">${escapeHtml(m.language)}</span>
                            <span class="tag-genre">${escapeHtml(m.genre)}</span>
                        </div>
                        <div class="movie-card-footer">
                            <span class="duration-info">⏱️ ${durationFormatted}</span>
                            <span class="book-cta">
                                ${isNowShowing ? 'Book Now →' : 'Details →'}
                            </span>
                        </div>
                    </div>
                </a>
            `;
        }).join('');
    }

    // 4. Update Featured Hero Banner
    function updateFeaturedHero(movies) {
        const heroBanner = document.getElementById('featured-hero');
        if (!heroBanner || movies.length === 0) return;

        const featured = movies[0];
        const bannerBg = document.getElementById('hero-banner-bg');
        const heroTitle = document.getElementById('hero-title');
        const heroMeta = document.getElementById('hero-meta');
        const heroDesc = document.getElementById('hero-desc');
        const heroBookBtn = document.getElementById('hero-book-btn');
        const heroTrailerBtn = document.getElementById('hero-trailer-btn');

        if (bannerBg) bannerBg.style.backgroundImage = `url('${featured.banner_url || featured.poster_url}')`;
        if (heroTitle) heroTitle.textContent = featured.title;
        if (heroDesc) heroDesc.textContent = featured.synopsis;
        if (heroBookBtn) heroBookBtn.href = `/movie.html?id=${featured.id}`;

        if (heroMeta) {
            heroMeta.innerHTML = `
                <span>⭐ <strong>${featured.rating}</strong>/10</span>
                <span>•</span>
                <span>${featured.language}</span>
                <span>•</span>
                <span>${featured.genre}</span>
                <span>•</span>
                <span>⏱️ ${formatDuration(featured.duration_mins)}</span>
            `;
        }

        if (heroTrailerBtn) {
            if (featured.trailer_url) {
                heroTrailerBtn.style.display = 'inline-flex';
                heroTrailerBtn.onclick = () => openTrailerModal(featured.trailer_url, featured.title);
            } else {
                heroTrailerBtn.style.display = 'none';
            }
        }
    }

    // 5. Update Tab Counts
    async function updateCounts() {
        try {
            const [resNow, resUpcoming] = await Promise.all([
                fetch('/api/movies?status=now_showing'),
                fetch('/api/movies?status=upcoming')
            ]);
            const dataNow = await resNow.json();
            const dataUpcoming = await resUpcoming.json();

            if (nowShowingCount) nowShowingCount.textContent = dataNow.count || 0;
            if (upcomingCount) upcomingCount.textContent = dataUpcoming.count || 0;
        } catch (err) {
            console.error('Error fetching counts:', err);
        }
    }

    function renderEmpty(message) {
        moviesGrid.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🎬</div>
                <h3 style="font-size: 1.3rem; margin-bottom: 0.5rem;">No Movies Found</h3>
                <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">${escapeHtml(message)}</p>
                <button type="button" class="btn btn-secondary btn-sm" id="empty-reset-btn">Reset All Filters</button>
            </div>
        `;

        document.getElementById('empty-reset-btn')?.addEventListener('click', resetAllFilters);
    }

    // Reset All Filters
    function resetAllFilters() {
        state.search = '';
        state.language = 'all';
        state.genre = 'all';
        state.date = '';

        if (searchInput) searchInput.value = '';
        if (clearSearchBtn) clearSearchBtn.style.display = 'none';
        if (langSelect) langSelect.value = 'all';
        if (genreSelect) genreSelect.value = 'all';

        if (dateChipContainer) {
            dateChipContainer.querySelectorAll('.date-chip').forEach((c, idx) => {
                if (idx === 0) c.classList.add('active');
                else c.classList.remove('active');
            });
        }

        fetchAndRenderMovies();
    }

    // Event Listeners
    // Tab switching
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.status = btn.dataset.status;
            fetchAndRenderMovies();
        });
    });

    // Debounced Search (FR-5)
    let searchTimeout;
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const val = searchInput.value.trim();
            if (clearSearchBtn) {
                clearSearchBtn.style.display = val.length > 0 ? 'block' : 'none';
            }
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                state.search = val;
                fetchAndRenderMovies();
            }, 300);
        });
    }

    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            searchInput.value = '';
            clearSearchBtn.style.display = 'none';
            state.search = '';
            fetchAndRenderMovies();
        });
    }

    // Filter changes
    if (langSelect) {
        langSelect.addEventListener('change', () => {
            state.language = langSelect.value;
            fetchAndRenderMovies();
        });
    }

    if (genreSelect) {
        genreSelect.addEventListener('change', () => {
            state.genre = genreSelect.value;
            fetchAndRenderMovies();
        });
    }

    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', resetAllFilters);
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

    // Modal Trailer Player
    window.openTrailerModal = function(url, title) {
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
    };

    // Initialize
    init();
});
