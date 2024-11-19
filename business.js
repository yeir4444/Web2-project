const user = require('./user'); // Persistence layer
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const sendVerificationEmail = require('./email');


/**
 * Hashes a password using PBKDF2 with a random salt.
 * @param {string} password - The plaintext password to hash.
 * @returns {string} The hashed password in the format `salt:hash`.
 */
function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex'); 
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha256').toString('hex'); 
    return `${salt}:${hash}`; 
}


/**
 * Verifies if the given password matches the stored hashed password.
 * @param {string} password - The plaintext password to verify.
 * @param {string} storedPassword - The stored password in the format `salt:hash`.
 * @returns {boolean} True if the password matches, false otherwise.
 */
function verifyPassword(password, storedPassword) {
    const [salt, hash] = storedPassword.split(':');
    const hashedPassword = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha256').toString('hex'); 
    return hash === hashedPassword;
}


/**
 * Authenticates a user by email and password, and creates a session if login is successful.
 * @param {string} email - The user's email.
 * @param {string} password - The user's plaintext password.
 * @returns {Promise<string|null>} The session ID if login is successful, or null otherwise.
 */
async function login(email, password) {
    const userRecord = await user.findUserByEmail(email);
    
    if (userRecord && verifyPassword(password, userRecord.password) {
        let session = await user.createSession(userRecord._id);
        return session.insertedId;
    }
    return { error: "Invalid credentials" };
}


/**
 * Registers a new user and sends a verification email.
 * @param {string} username - The username of the new user.
 * @param {string} email - The email address of the new user.
 * @param {string} password - The plaintext password of the new user.
 * @param {string} role - The role of the new user (e.g., "user" or "admin").
 * @returns {Promise<Object>} A message indicating success or an error message if registration fails.
 */
async function registerUser(username, email, password, role) {
    try {
        const hashedPassword = hashPassword(password);
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


/**
 * Verifies a user's account using a verification token.
 * @param {string} verificationToken - The verification token sent to the user's email.
 * @returns {Promise<Object>} A message indicating success or an error message if verification fails.
 */
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


/**
 * Resets a user's password by updating it with a new hashed password.
 * @param {string} email - The user's email.
 * @param {string} newPassword - The new plaintext password.
 * @returns {Promise<Object>} A message indicating success or an error message if reset fails.
 */
async function resetPassword(email, newPassword) {
    try {
        const userRecord = await user.findUserByEmail(email);
        if (userRecord) {
            const hashedPassword = hashPassword(newPassword);
            await user.updateUserPassword(userRecord._id, hashedPassword);
            return { message: "Password reset successfully." };
        }
        return { error: "User not found." };
    } catch (error) {
        return { error: "Failed to reset password. Please try again later." };
    }
}


/**
 * Looks up a session by its ID, and if the session is valid, 
 * fetches the user associated with the session's user ID. Returns the user 
 * record or null if no session or user is found.
 *
 * @param {string} sessionId - The ID of the session to look up.
 * @returns {Promise<Object|null>} Resolves to the user record (plain object) if found, 
 * or `null` if no session or user is associated with the given session ID.
 * @throws {Error} Throws an error if the database query fails or encounters an unexpected issue.
 */
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
