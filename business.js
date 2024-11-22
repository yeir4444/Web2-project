const user = require('./user'); // Persistence layer
const emailUtility = require('./emailUtility');
const crypto = require('crypto');
const nodemailer = require('nodemailer')

async function login(email, password) {
    const userRecord = await user.findUserByEmail(email);

    if (!userRecord) {
        return { error: "Invalid email or password." };
    }

    // Hash the provided password
    const hash = crypto.createHash('sha256').update(password).digest('hex');

    if (userRecord.password !== hash) {
        return { error: "Invalid email or password." };
    }

    // Generate session
    const sessionKey = crypto.randomUUID();
    const sessionData = {
        key: sessionKey,
        expiry: new Date(Date.now() + 1000 * 60 * 30), // 30 minutes
        data: {
            username: userRecord.username,
            email: userRecord.email,
            role: userRecord.role,
            profilePicture: userRecord.profilePicture,
        },
    };

    await user.startSession(sessionData);

    return sessionData;
}

async function updateProfilePicture(username, profilePicturePath) {
    // Update the user's profile picture path
    const userRecord = await user.getUserDetails(username);
    if (!userRecord) {
        return { error: "User not found" };
    }

    await user.updateUser(username, { profilePicture: profilePicturePath });
    return { message: "Profile picture updated successfully" };
}

async function terminateSession(key) {
    if (!key) {
        return
    }
    await user.terminateSession(key)
}

async function getSession(key) {
    const session = await user.getSession(key);
    return session;
}

// Inside business.js

async function resetPassword(email) {
    let details = await user.findUserByEmail(email);

    if (details) {
        let key = crypto.randomUUID();  // Generate a reset token
        details.resetkey = key;
        details.resetkeyExpiry = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24 hours expiry time
        await user.updateUser(details);

        // Create the reset link to be sent in the email
        const resetLink = `http://127.0.0.1:8000/reset-password?token=${key}`;
        
        // Simulate sending the reset email
        await emailUtility.sendPasswordResetEmail(email, key);

        return { message: "Password reset link sent successfully. Please check your email." };
    }

    return { error: "No account found with that email." };
}



async function checkReset(key) {
    return user.checkReset(key)
}

async function setPassword(key, pw) {
    let hash = crypto.createHash('sha256')
    hash.update(pw)
    let hashed_pw = hash.digest('hex')

    await user.updatePassword(key, hashed_pw)
}

async function registerUser(username, email, password, role, profilePicturePath = '') {
    const userRecord = await user.findUserByEmail(email);
    if (userRecord) {
        return { error: "Email already registered" };  // If user exists, return an error
    }

    // Create new user object
    const newUser = {
        username,
        email,
        password,
        role,
        profilePicture: profilePicturePath,  // Save the profile picture path if provided
    };

    // Create the user in the database
    await user.createUser(newUser, profilePicturePath);

    // Generate a verification token (to send via email)
    const verificationLink = `http://127.0.0.1:8000/verify?token=${newUser.verificationToken}`;

    // Simulate sending verification email (email sending logic can be called here)
    await emailUtility.sendVerificationEmail(email, verificationLink);

    return { message: "User registered successfully. Check your email to verify your account." };
}


async function verifyUser(token) {
    const result = await user.verifyUser(token);
    if (result) {
        return { message: "Account verified successfully." };
    } else {
        return { error: "Invalid or expired verification token." };
    }
}

async function sendResetEmail(email, link) {
    let transporter = nodemailer.createTransport({
        host: "127.0.0.1",
        port: 25
    });

    let body = `
        A password reset request has been made for your account.  Please
        follow <a href="http://127.0.0.1:8000/reset-password/?key=${key}">this link</a>
        to set a new password for your account.`

    await transporter.sendMail({
        from: "no-reply@yourdomain.com",
        to: email,
        subject: "Password Reset",
        html: body
    });
}

async function sendVerificationEmail(email, link) {
    let transporter = nodemailer.createTransport({
        host: "127.0.0.1",
        port: 25
    });

    let body = `
    Please verify your account by clicking the following link: <a href="${link}">Verify Account</a>
    `;

    await transporter.sendMail({
        from: "no-reply@yourdomain.com",
        to: email,
        subject: "Account Verification",
        html: body
    });
}

async function findUserByResetToken(token) {
    return await user.findUserByResetToken(token);
}
module.exports = {
    login,
    resetPassword,
    setPassword,
    checkReset,
    getSession,
    terminateSession,
    registerUser,
    updateProfilePicture,
    verifyUser,
    findUserByResetToken

};
