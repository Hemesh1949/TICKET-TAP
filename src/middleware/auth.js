// Authentication & Authorization Middleware for Ticket Tap

// Check if user is logged in
function requireAuth(req, res, next) {
    if (req.session && req.session.user) {
        return next();
    }

    if (req.xhr || req.headers.accept?.includes('application/json') || req.originalUrl.startsWith('/api/')) {
        return res.status(401).json({
            error: 'Authentication required. Please log in to continue.',
            code: 'AUTH_REQUIRED'
        });
    }

    const redirectUrl = encodeURIComponent(req.originalUrl);
    return res.redirect(`/login.html?redirect=${redirectUrl}`);
}

// Restrict access to customer accounts (or any logged in user booking tickets)
function requireCustomer(req, res, next) {
    if (!req.session || !req.session.user) {
        if (req.xhr || req.headers.accept?.includes('application/json') || req.originalUrl.startsWith('/api/')) {
            return res.status(401).json({
                error: 'Please log in as a customer to book tickets.',
                code: 'CUSTOMER_AUTH_REQUIRED'
            });
        }
        const redirectUrl = encodeURIComponent(req.originalUrl);
        return res.redirect(`/login.html?redirect=${redirectUrl}`);
    }
    next();
}

// Restrict access to Admin accounts only
function requireAdmin(req, res, next) {
    if (!req.session || !req.session.user) {
        if (req.xhr || req.headers.accept?.includes('application/json') || req.originalUrl.startsWith('/api/')) {
            return res.status(401).json({
                error: 'Admin authentication required.',
                code: 'ADMIN_AUTH_REQUIRED'
            });
        }
        return res.redirect('/login.html?error=admin_required');
    }

    if (req.session.user.role !== 'admin') {
        if (req.xhr || req.headers.accept?.includes('application/json') || req.originalUrl.startsWith('/api/')) {
            return res.status(403).json({
                error: 'Access denied: Admin privileges required.',
                code: 'FORBIDDEN'
            });
        }
        return res.status(403).send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>Access Denied - Ticket Tap</title>
                <link rel="stylesheet" href="/css/style.css">
                <link rel="stylesheet" href="/css/auth.css">
            </head>
            <body class="auth-body">
                <div class="auth-card text-center">
                    <div class="auth-icon" style="background: rgba(239, 68, 68, 0.15); color: #ef4444;">🔒</div>
                    <h2>Access Denied</h2>
                    <p class="auth-sub">You do not have permission to access the administrative area.</p>
                    <a href="/" class="btn-primary" style="display:inline-block; margin-top: 1.5rem;">Return Home</a>
                </div>
            </body>
            </html>
        `);
    }

    next();
}

// Helper to attach user state to locals
function attachUserToLocals(req, res, next) {
    res.locals.currentUser = req.session?.user || null;
    next();
}

module.exports = {
    requireAuth,
    requireCustomer,
    requireAdmin,
    attachUserToLocals
};
