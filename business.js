const user = require('./user'); // Persistence layer
const crypto = require('crypto');
const nodemailer = require('nodemailer');

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
            languagesFluent: userRecord.languagesFluent,
            languagesToLearn: userRecord.languagesToLearn,
            contacts: userRecord.contacts,
        },
    };

    await user.startSession(sessionData);

    return sessionData;
}

async function updateProfilePicture(username, profilePicturePath) {
    try {
        await user.updateProfilePicture(username, profilePicturePath);
    } catch (error) {
        console.error('Error updating profile picture:', error);
        throw error;
    }
}

async function updateSession(sessionKey, updatedData) {
    try {
        await user.updateSession(sessionKey, updatedData);
    } catch (error) {
        console.error('Error updating session:', error);
        throw error;
    }
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

async function resetPassword(email) {
    const user = await user.findUserByEmail(email);
    if (!user) {
        return { error: "No account found with that email." };
    }

    const token = crypto.randomUUID();
    const expiry = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24 hours expiry

    await user.updateUser(user.username, { resetkey: token, resetkeyExpiry: expiry });

    const resetLink = `http://127.0.0.1:8000/reset-password?token=${token}`;
    await sendResetEmail(email, resetLink);

    return { message: "Password reset link sent successfully. Please check your email." };
}

async function checkReset(key) {
    return user.checkReset(key)
}

async function setPassword(token, newPassword) {
    const hashedPassword = crypto.createHash('sha256').update(newPassword).digest('hex');
    await user.updatePassword(token, hashedPassword);
}

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

    await user.createUser(newUser, profilePicturePath);
    //Send verification email
    const verificationLink = `http://127.0.0.1:8000/verify?token=${newUser.verificationToken}`
    await sendVerificationEmail(email, verificationLink);
    return { message: "User registered successfully! please check email to verify registration." };
}

async function verifyUser(token) {
    const result = await user.verifyUser(token);
    if (result) {
        return { message: "Account verified successfully." };
    } else {
        return { error: "Invalid or expired verification token." };
    }
}

async function sendResetEmail(email, resetLink) {
    const transporter = nodemailer.createTransport({
        host: "127.0.0.1", 
        port: 25,
    });

    const body = `
        <p>You have requested to reset your password.</p>
        <p>Click the link below to reset your password:</p>
        <a href="${resetLink}">${resetLink}</a>
    `;

    await transporter.sendMail({
        from: "no-reply@yourdomain.com",
        to: email,
        subject: "Reset Password",
        html: body,
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
    try {
        console.log("Searching for user with reset token:", token);
        return await user.findUserByResetToken(token);
    } catch (error) {
        console.error("Error finding user by reset token:", error);
        throw error;
    }
}


async function assignBadges(username) {
    const messages = await messagesCollection.countDocuments({ sender: username });
    const replies = await messagesCollection.countDocuments({ receiver: username });

    const badges = [];
    if (messages >= 1 && replies >= 1) badges.push("First Conversation");
    if (messages >= 100) badges.push("100 Messages Sent");

    await usersCollection.updateOne(
        { username },
        { $addToSet: { badges: { $each: badges } } }
    );

    // Update session to reflect new badges
    const session = await user.getSessionByUsername(username);
    if (session) {
        session.data.badges = badges;
        await user.updateSession(session.key, session);
    }
}

async function getContacts(username) {
    try {
        const user = await user.getUserDetails(username);
        return user.contacts || [];
    } catch (error) {
        return { error: error.message };
    }
}

async function addContact(username, contactUsername) {
    try {
        const result = await user.addContact(username, contactUsername);
        return { message: "Contact added successfully." };
    } catch (error) {
        return { error: error.message };
    }
}

async function removeContact(username, contactUsername) {
    try {
        await user.removeContact(username, contactUsername);
        return { message: "Contact removed successfully." };
    } catch (error) {
        return { error: error.message };
    }
}

async function sendMessage(sender, receiver, content) {
    if (!content || content.trim() === "") {
        return { error: "Message content cannot be empty." };
    }
    try {
        await user.sendMessage(sender, receiver, content);
        return { message: "Message sent successfully." };
    } catch (error) {
        return { error: error.message };
    }
}

async function getMessages(user1, user2) {
    try {
        const messages = await user.getMessages(user1, user2);
        return { messages };
    } catch (error) {
        return { error: error.message };
    }
}

async function blockUser(username, blockedUsername) {
    try {
        await user.blockUser(username, blockedUsername);
        return { message: "User blocked successfully." };
    } catch (error) {
        return { error: error.message };
    }
}

async function unblockUser(username, blockedUsername) {
    try {
        await user.unblockUser(username, blockedUsername);
        return { message: "User unblocked successfully." };
    } catch (error) {
        return { error: error.message };
    }
}

async function updateLanguages(username, fluentLanguages, languagesToLearn) {
    try {
        const updates = {
            languagesFluent: fluentLanguages.split(',').map(lang => lang.trim()),
            languagesToLearn: languagesToLearn.split(',').map(lang => lang.trim())
        };

        await user.updateUser(username, updates);
    } catch (error) {
        console.error('Error updating languages:', error);
        throw error;
    }
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
    findUserByResetToken,
    assignBadges, 
    addContact, 
    removeContact,
    sendMessage,
    getMessages,
    blockUser,
    unblockUser,
    getContacts,
    updateLanguages,
    updateSession
};
