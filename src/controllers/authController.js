const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { db } = require('../config/db');

// Regular Expressions for input validation
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_REGEX = /^[0-9]{10}$/;

// 1. Register User (FR-1)
exports.register = async (req, res) => {
    try {
        const { name, email, mobile, password } = req.body;

        // Validation: Required fields
        if (!name || !email || !mobile || !password) {
            return res.status(400).json({
                error: 'All fields (name, email, mobile, password) are required.'
            });
        }

        const trimmedName = name.trim();
        const trimmedEmail = email.trim().toLowerCase();
        const trimmedMobile = mobile.trim();

        // Validation: Name length
        if (trimmedName.length < 2) {
            return res.status(400).json({
                error: 'Full name must be at least 2 characters long.'
            });
        }

        // Validation: Email format
        if (!EMAIL_REGEX.test(trimmedEmail)) {
            return res.status(400).json({
                error: 'Please provide a valid email address.'
            });
        }

        // Validation: Mobile number format
        if (!MOBILE_REGEX.test(trimmedMobile)) {
            return res.status(400).json({
                error: 'Please enter a valid 10-digit mobile number.'
            });
        }

        // Validation: Password length
        if (password.length < 6) {
            return res.status(400).json({
                error: 'Password must be at least 6 characters long.'
            });
        }

        // Check if email already exists
        const existingUser = db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(trimmedEmail);
        if (existingUser) {
            return res.status(409).json({
                error: 'An account with this email address already exists.'
            });
        }

        // Hash password with bcrypt
        const salt = bcrypt.genSaltSync(10);
        const passwordHash = bcrypt.hashSync(password, salt);

        // Insert new user with customer role
        const insertStmt = db.prepare(`
            INSERT INTO users (name, email, mobile, password, role)
            VALUES (?, ?, ?, ?, 'customer')
        `);

        const result = insertStmt.run(trimmedName, trimmedEmail, trimmedMobile, passwordHash);

        const newUser = {
            id: result.lastInsertRowid,
            name: trimmedName,
            email: trimmedEmail,
            mobile: trimmedMobile,
            role: 'customer'
        };

        // Create session for immediate login
        req.session.user = newUser;

        return res.status(201).json({
            success: true,
            message: 'Registration successful! Welcome to Ticket Tap.',
            user: newUser
        });

    } catch (error) {
        console.error('Registration error:', error);
        return res.status(500).json({
            error: 'Internal server error while processing registration.'
        });
    }
};

// 2. Login User (FR-2)
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                error: 'Email and password are required.'
            });
        }

        const trimmedEmail = email.trim().toLowerCase();

        // Query user by email
        const user = db.prepare(`
            SELECT id, name, email, mobile, password, role
            FROM users
            WHERE LOWER(email) = ?
        `).get(trimmedEmail);

        if (!user) {
            return res.status(401).json({
                error: 'Invalid email or password.'
            });
        }

        // Verify password hash
        const isMatch = bcrypt.compareSync(password, user.password);
        if (!isMatch) {
            return res.status(401).json({
                error: 'Invalid email or password.'
            });
        }

        // Set session
        const sessionUser = {
            id: user.id,
            name: user.name,
            email: user.email,
            mobile: user.mobile,
            role: user.role
        };
        req.session.user = sessionUser;

        return res.json({
            success: true,
            message: `Welcome back, ${user.name}!`,
            user: sessionUser
        });

    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({
            error: 'Internal server error during login.'
        });
    }
};

// 3. Logout User (FR-2)
exports.logout = (req, res) => {
    if (req.session) {
        req.session.destroy((err) => {
            if (err) {
                console.error('Logout error:', err);
                return res.status(500).json({ error: 'Failed to log out.' });
            }
            res.clearCookie('connect.sid');
            return res.json({
                success: true,
                message: 'Logged out successfully.'
            });
        });
    } else {
        return res.json({ success: true, message: 'Already logged out.' });
    }
};

// 4. Get Current User Profile (FR-2)
exports.getCurrentUser = (req, res) => {
    if (req.session && req.session.user) {
        return res.json({
            authenticated: true,
            user: req.session.user
        });
    }
    return res.json({
        authenticated: false,
        user: null
    });
};

// 5. Request Password Reset (FR-3)
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                error: 'Please enter your registered email address.'
            });
        }

        const trimmedEmail = email.trim().toLowerCase();
        if (!EMAIL_REGEX.test(trimmedEmail)) {
            return res.status(400).json({
                error: 'Please enter a valid email address.'
            });
        }

        const user = db.prepare('SELECT id, name, email FROM users WHERE LOWER(email) = ?').get(trimmedEmail);

        if (!user) {
            return res.status(404).json({
                error: 'No account found with this email address.'
            });
        }

        // Generate secure 64-char reset token
        const resetToken = crypto.randomBytes(32).toString('hex');

        // Token expires in 15 minutes
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

        // Invalidate any previous unused tokens for this user
        db.prepare('UPDATE password_resets SET used = 1 WHERE user_id = ?').run(user.id);

        // Store new reset token
        db.prepare(`
            INSERT INTO password_resets (user_id, token, expires_at, used)
            VALUES (?, ?, ?, 0)
        `).run(user.id, resetToken, expiresAt);

        // Generate simulated reset link
        const resetUrl = `/reset-password.html?token=${resetToken}`;

        return res.json({
            success: true,
            message: 'Password reset link generated successfully.',
            user: { name: user.name, email: user.email },
            resetToken,
            resetUrl,
            expiresInMinutes: 15
        });

    } catch (error) {
        console.error('Forgot password error:', error);
        return res.status(500).json({
            error: 'Internal server error while processing password reset.'
        });
    }
};

// 6. Verify Reset Token (FR-3)
exports.verifyResetToken = (req, res) => {
    try {
        const { token } = req.query;

        if (!token) {
            return res.status(400).json({ valid: false, error: 'Reset token is required.' });
        }

        const resetRecord = db.prepare(`
            SELECT pr.id, pr.user_id, pr.expires_at, pr.used, u.email, u.name
            FROM password_resets pr
            JOIN users u ON pr.user_id = u.id
            WHERE pr.token = ?
        `).get(token);

        if (!resetRecord) {
            return res.status(400).json({ valid: false, error: 'Invalid reset link.' });
        }

        if (resetRecord.used === 1) {
            return res.status(400).json({ valid: false, error: 'This reset link has already been used.' });
        }

        if (new Date(resetRecord.expires_at) < new Date()) {
            return res.status(400).json({ valid: false, error: 'This reset link has expired. Please request a new one.' });
        }

        return res.json({
            valid: true,
            email: resetRecord.email,
            name: resetRecord.name
        });

    } catch (error) {
        console.error('Token verification error:', error);
        return res.status(500).json({ valid: false, error: 'Failed to verify token.' });
    }
};

// 7. Reset Password (FR-3)
exports.resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({
                error: 'Reset token and new password are required.'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                error: 'Password must be at least 6 characters long.'
            });
        }

        const resetRecord = db.prepare(`
            SELECT pr.id, pr.user_id, pr.expires_at, pr.used
            FROM password_resets pr
            WHERE pr.token = ?
        `).get(token);

        if (!resetRecord || resetRecord.used === 1 || new Date(resetRecord.expires_at) < new Date()) {
            return res.status(400).json({
                error: 'Reset token is invalid or has expired.'
            });
        }

        // Hash new password
        const salt = bcrypt.genSaltSync(10);
        const passwordHash = bcrypt.hashSync(newPassword, salt);

        // Update password and invalidate token in transaction
        const updateTransaction = db.transaction(() => {
            db.prepare('UPDATE users SET password = ? WHERE id = ?').run(passwordHash, resetRecord.user_id);
            db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').run(resetRecord.id);
        });

        updateTransaction();

        return res.json({
            success: true,
            message: 'Your password has been successfully reset! You can now log in.'
        });

    } catch (error) {
        console.error('Password reset error:', error);
        return res.status(500).json({
            error: 'Internal server error while resetting password.'
        });
    }
};
