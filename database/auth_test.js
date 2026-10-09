// Authentication and Authorization Verification Test
const assert = require('assert');

async function runTests() {
    const baseUrl = 'http://localhost:3000';
    console.log('🧪 Starting FR-1, FR-2, FR-3 Verification Tests...\n');

    let cookie = '';

    // Helper fetch wrapper
    async function apiFetch(path, options = {}) {
        options.headers = options.headers || {};
        if (cookie) options.headers['cookie'] = cookie;
        options.headers['Content-Type'] = 'application/json';
        const res = await fetch(`${baseUrl}${path}`, options);
        const setCookie = res.headers.get('set-cookie');
        if (setCookie) {
            cookie = setCookie.split(';')[0];
        }
        const data = await res.json().catch(() => ({}));
        return { status: res.status, data };
    }

    // --- TEST 1: FR-1 Registration Validation ---
    console.log('▶ TEST 1: Register validation (missing fields)');
    const res1 = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test User' })
    });
    assert.strictEqual(res1.status, 400, 'Expected 400 on missing fields');
    console.log('  ✅ Handled missing fields correctly.');

    console.log('▶ TEST 2: Register validation (invalid mobile)');
    const res2 = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test User', email: 'valid@example.com', mobile: '123', password: 'password123' })
    });
    assert.strictEqual(res2.status, 400, 'Expected 400 on invalid mobile');
    console.log('  ✅ Handled invalid mobile format.');

    console.log('▶ TEST 3: Register valid customer account (FR-1)');
    const uniqueEmail = `test_${Date.now()}@example.com`;
    const res3 = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
            name: 'Test Customer',
            email: uniqueEmail,
            mobile: '9876543219',
            password: 'MyPassword123'
        })
    });
    assert.strictEqual(res3.status, 201, 'Expected 201 Created on registration');
    assert.strictEqual(res3.data.user.role, 'customer');
    console.log(`  ✅ Registered new customer (${uniqueEmail}) successfully.`);

    console.log('▶ TEST 4: Register duplicate email check (FR-1 unique email)');
    const res4 = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
            name: 'Another User',
            email: uniqueEmail,
            mobile: '9876543218',
            password: 'MyPassword123'
        })
    });
    assert.strictEqual(res4.status, 409, 'Expected 409 Conflict for duplicate email');
    console.log('  ✅ Rejected duplicate email registration.');

    // --- TEST 5: FR-2 Login & Logout ---
    console.log('▶ TEST 5: Login with wrong password (FR-2)');
    const res5 = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: uniqueEmail, password: 'WrongPassword' })
    });
    assert.strictEqual(res5.status, 401, 'Expected 401 on wrong password');
    console.log('  ✅ Rejected login with invalid credentials.');

    console.log('▶ TEST 6: Login with valid credentials (FR-2)');
    const res6 = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: uniqueEmail, password: 'MyPassword123' })
    });
    assert.strictEqual(res6.status, 200, 'Expected 200 on valid login');
    assert.strictEqual(res6.data.user.email, uniqueEmail);
    console.log('  ✅ Logged in successfully and session established.');

    console.log('▶ TEST 7: Access customer-protected endpoint with customer session (FR-2)');
    const res7 = await apiFetch('/api/auth/customer-protected');
    assert.strictEqual(res7.status, 200, 'Customer should access customer-protected route');
    console.log('  ✅ Customer access granted.');

    console.log('▶ TEST 8: Customer attempting to access admin-protected endpoint (FR-2)');
    const res8 = await apiFetch('/api/auth/admin-protected');
    assert.strictEqual(res8.status, 403, 'Customer must be denied admin route (403)');
    console.log('  ✅ Forbidden (403) correctly enforced for non-admin user.');

    console.log('▶ TEST 9: Admin login and access admin-protected endpoint (FR-2)');
    const res9 = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@tickettap.com', password: 'Admin@123' })
    });
    assert.strictEqual(res9.status, 200);
    assert.strictEqual(res9.data.user.role, 'admin');

    const res10 = await apiFetch('/api/auth/admin-protected');
    assert.strictEqual(res10.status, 200);
    console.log('  ✅ Admin user authenticated and granted admin privileges.');

    console.log('▶ TEST 10: Logout (FR-2)');
    const res11 = await apiFetch('/api/auth/logout', { method: 'POST' });
    assert.strictEqual(res11.status, 200);

    const res12 = await apiFetch('/api/auth/me');
    assert.strictEqual(res12.data.authenticated, false);
    console.log('  ✅ Session cleared on logout.');

    // --- TEST 11: FR-3 Password Reset ---
    console.log('▶ TEST 11: Forgot password generates simulated link (FR-3)');
    const res13 = await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: uniqueEmail })
    });
    assert.strictEqual(res13.status, 200);
    assert(res13.data.resetUrl.includes('token='), 'Expected resetUrl with token');
    const token = res13.data.resetToken;
    console.log(`  ✅ Simulated password reset link generated: ${res13.data.resetUrl}`);

    console.log('▶ TEST 12: Verify reset token (FR-3)');
    const res14 = await apiFetch(`/api/auth/verify-token?token=${token}`);
    assert.strictEqual(res14.status, 200);
    assert.strictEqual(res14.data.valid, true);
    console.log('  ✅ Token validated successfully.');

    console.log('▶ TEST 13: Reset password with new password (FR-3)');
    const res15 = await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword: 'BrandNewPassword123' })
    });
    assert.strictEqual(res15.status, 200);
    console.log('  ✅ Password updated.');

    console.log('▶ TEST 14: Log in with newly reset password (FR-3)');
    const res16 = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: uniqueEmail, password: 'BrandNewPassword123' })
    });
    assert.strictEqual(res16.status, 200);
    console.log('  ✅ Successfully logged in with new password.');

    console.log('\n🎉 ALL FR-1, FR-2, FR-3 TESTS PASSED SUCCESSFULLY!\n');
}

runTests().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
