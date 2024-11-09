const user = require('./user') // persistence layer
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const sendVerificationEmail = require('./email');

async function login(email, password) {
    let user = await user.findUserByEmail(email);
    if (user && user.password == password) {
        let session = await user.createSession(user._id);
        return session.insertedId;
    }
    return null;
}

async function registerUser(username, email, password){
    try{
        const hashedPassword = await bcrypt.hash(password, 10);
        const verificationToken = uuidv4();
        const user = {
            username,
            email,
            password: hashedPassword,
            isVerified: false,
            verificationToken
        };

        await user.createUser(user);
        await sendVerificationEmail(email, verificationToken);
        return { message: "User registered successfully. Please check your email to verify your account."};
    } catch (error){
        return{ error: "Failed to register user. Please try again later."};
    }
}

async function verifyUser(verificationToken) {
    try {
        const user = await user.findUserByVerificationToken(verificationToken);
        if (user) {
            await user.updateUserVerification(user._id);
            return { message: "User verified successfully." };
        }
        return { error: "Invalid or expired verification token." };
    } catch (error) {
        return { error: "Failed to verify user. Please try again later." };
    }
}

async function resetPassword(email, newPassword) {
    try {
        const user = await user.findUserByEmail(email);
        if (user) {
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            await user.updateUserPassword(user._id, hashedPassword);
            return { message: "Password reset successfully." };
        }
        return { error: "User not found." };
    } catch (error) {
        return { error: "Failed to reset password. Please try again later." };
    }
}

module.exports = {
    login,
    registerUser,
    VerifyUser,
    resetPassword
};
