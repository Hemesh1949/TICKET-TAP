/**
 * Ticket Tap - Shared Authentication Utility
 */

const Auth = {
    // Check current session
    async checkSession() {
        try {
            const res = await fetch('/api/auth/me');
            const data = await res.json();
            return data;
        } catch (err) {
            console.error('Session check failed:', err);
            return { authenticated: false, user: null };
        }
    },

    // Update navigation bar with current user info
    async updateNavbar() {
        const userNav = document.getElementById('nav-user-area');
        if (!userNav) return;

        const session = await this.checkSession();

        if (session.authenticated && session.user) {
            const user = session.user;
            const roleClass = user.role === 'admin' ? 'role-admin' : 'role-customer';
            const roleLabel = user.role === 'admin' ? 'Admin' : 'Customer';

            userNav.innerHTML = `
                <div class="nav-user">
                    <div class="user-badge">
                        <span>👤 ${this.escapeHtml(user.name)}</span>
                        <span class="role-tag ${roleClass}">${roleLabel}</span>
                    </div>
                    ${user.role === 'admin' ? '<a href="/admin.html" class="nav-link">Admin Panel</a>' : ''}
                    <button id="logout-btn" class="btn btn-outline btn-sm">Logout</button>
                </div>
            `;

            document.getElementById('logout-btn')?.addEventListener('click', () => this.logout());
        } else {
            userNav.innerHTML = `
                <div class="nav-user">
                    <a href="/login.html" class="nav-link">Sign In</a>
                    <a href="/register.html" class="btn btn-primary btn-sm">Register</a>
                </div>
            `;
        }
    },

    // Handle user logout
    async logout() {
        try {
            const res = await fetch('/api/auth/logout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            if (data.success) {
                window.location.href = '/login.html?message=logged_out';
            }
        } catch (err) {
            console.error('Logout failed:', err);
            window.location.href = '/login.html';
        }
    },

    // Show alert banner
    showAlert(containerId, message, type = 'danger') {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.className = `alert alert-${type}`;
        container.innerHTML = `
            <span>${type === 'danger' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️'}</span>
            <div>${this.escapeHtml(message)}</div>
        `;
        container.classList.remove('d-none');
    },

    // Hide alert banner
    hideAlert(containerId) {
        const container = document.getElementById(containerId);
        if (container) {
            container.classList.add('d-none');
            container.innerHTML = '';
        }
    },

    // Helper to escape HTML and prevent XSS
    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    // Toggle password visibility
    setupPasswordToggle(btnId, inputId) {
        const btn = document.getElementById(btnId);
        const input = document.getElementById(inputId);
        if (!btn || !input) return;

        btn.addEventListener('click', () => {
            const isPassword = input.type === 'password';
            input.type = isPassword ? 'text' : 'password';
            btn.textContent = isPassword ? '👁️‍🗨️' : '👁️';
        });
    }
};

// Automatically run on DOM load
document.addEventListener('DOMContentLoaded', () => {
    Auth.updateNavbar();
});
