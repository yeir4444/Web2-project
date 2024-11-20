const user = require('./user'); // Persistence layer
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
        data: { username: userRecord.username,
            email: userRecord.email,
            role: userRecord.role,
            profilePicture: userRecord.profilePicture,
        },
    };

    await user.startSession(sessionData);

    return sessionData;
}

async function updateProfilePicture(username, profilePicturePath) {
    // Update the user's profile picture path (this function doesnt work yet)
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

async function resetPassword(email) { //i cant get this funtion to work plz send help
    let details = await user.getUserByEmail(email)
    if (details) {
        let key = crypto.randomUUID()
        details.resetkey = key
        await user.updateUser(details)
        
        let transporter = nodemailer.createTransport({
            host: "127.0.0.1",
            port: 25
        })

        let body = `
        A password reset request has been made for your account.  Please
        follow <a href="http://127.0.0.1:8000/reset-password/?key=${key}">this link</a>
        to set a new password for your account.`
        await transporter.sendMail({
            from: "?????",
            to: email,
            subject: "Password reset",
            html: body
        })
        console.log(body)
    }
    return undefined
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

//doesnt send and email to verify registration...
async function registerUser(username, email, password, role, profilePicturePath = '') {
    const userRecord = await user.findUserByEmail(email);
    if (userRecord) {
        return { error: "Email already registered" };
    }

    const newUser = {
        username,
        email,
        password,
        role,
        profilePicture: profilePicturePath,  // Save the profile picture path if provided
    };

    await user.createUser(newUser,  profilePicturePath);
    return { message: "User registered successfully" };
}

module.exports = {
    login,
    resetPassword,
    setPassword,
    checkReset,
    getSession,
    terminateSession,
    registerUser,
    updateProfilePicture

};
