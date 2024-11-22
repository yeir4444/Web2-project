// Simulate sending an email by logging to the console
function sendVerificationEmail(userEmail, token) {
    const verificationLink = `http://localhost:8000/verify?token=${token}`;

    // Simulate email by logging the HTML content
    console.log(`Simulating email sent to: ${userEmail}`);
    console.log(`Subject: Email Verification`);
    console.log(`HTML Content: <b>Please click the following link to verify your email: <a href="${verificationLink}">Verify Email</a></b>`);
}

function sendPasswordResetEmail(userEmail, resetToken) {
    const resetLink = `http://localhost:8000/reset-password?token=${resetToken}`;

    // Simulate email by logging the HTML content
    console.log(`Simulating email sent to: ${userEmail}`);
    console.log(`Subject: Password Reset`);
    console.log(`HTML Content: <b>Please click the following link to reset your password: <a href="${resetLink}">Reset Password</a></b>`);
}

module.exports = {
    sendVerificationEmail,
    sendPasswordResetEmail,
};
