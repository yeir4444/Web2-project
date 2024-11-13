const user = require('./user'); // Persistence layer
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const sendVerificationEmail = require('./email');

async function login(email, password) {
    const userRecord = await user.findUserByEmail(email);
    
    if (userRecord) {
        if (!userRecord.isVerified) {
            return { error: "Account not verified. Please check your email to verify your account." };
        }
        
        const isPasswordMatch = await bcrypt.compare(password, userRecord.password);
        if (isPasswordMatch) {
            const session = await user.createSession(userRecord._id);
            return { sessionId: session.insertedId };
        }
    }
    
    return { error: "Invalid credentials" };
}


async function registerUser(username, email, password, role) {
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const verificationToken = uuidv4();
        const newUser = {
            username,
            email,
            password: hashedPassword,
            role,
            isVerified: false,
            verificationToken
        };

        await user.createUser(newUser);
        await sendVerificationEmail(email, verificationToken);
        return { message: "User registered successfully. Please check your email to verify your account." };
    } catch (error) {
        return { error: "Failed to register user. Please try again later." };
    }
}

async function verifyUser(verificationToken) {
    try {
        const userRecord = await user.findUserByVerificationToken(verificationToken);
        if (userRecord) {
            await user.updateUserVerification(userRecord._id);
            return { message: "User verified successfully." };
        }
        return { error: "Invalid or expired verification token." };
    } catch (error) {
        return { error: "Failed to verify user. Please try again later." };
    }
}

async function resetPassword(email, newPassword) {
    try {
        const userRecord = await user.findUserByEmail(email);
        if (userRecord) {
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            await user.updateUserPassword(userRecord._id, hashedPassword);
            return { message: "Password reset successfully." };
        }
        return { error: "User not found." };
    } catch (error) {
        return { error: "Failed to reset password. Please try again later." };
    }
}
async function getUserBySession(sessionId) {
    try {
        const session = await user.findSessionById(sessionId); // Finds session by ID
        console.log("Session found:", session);

        if (session) {
            const userRecord = await user.findUserById(new ObjectId(session.userId)); // Finds user by userId in the session
            console.log("User record found:", userRecord);

            return userRecord; // Return the user record (plain object)
        }

        return null; // No session found
    } catch (error) {
        console.error("Error in getUserBySession:", error);
        throw error;
    }
}


module.exports = {
    login,
    registerUser,
    verifyUser,
    resetPassword,
    getUserBySession // Expose this function
};
