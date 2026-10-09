const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// Public Auth Endpoints
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.get('/me', authController.getCurrentUser);
router.post('/forgot-password', authController.forgotPassword);
router.get('/verify-token', authController.verifyResetToken);
router.post('/reset-password', authController.resetPassword);

// Sample Protected Route for Testing Customer Auth
router.get('/customer-protected', requireAuth, (req, res) => {
    res.json({
        success: true,
        message: `Hello ${req.session.user.name}, you have customer access!`,
        user: req.session.user
    });
});

// Sample Protected Route for Testing Admin Auth
router.get('/admin-protected', requireAdmin, (req, res) => {
    res.json({
        success: true,
        message: `Welcome Admin ${req.session.user.name}, you have administrative privileges!`,
        user: req.session.user
    });
});

module.exports = router;
