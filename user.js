const { MongoClient, ObjectId } = require("mongodb");
const bcrypt = require('bcrypt');

let client;
let db;
let usersCollection;
let sessionsCollection;

async function connectToDatabase() {
    if (!client) {
        client = new MongoClient(''); // change this to your connection string and it should work
        await client.connect();
        db = client.db('language_exchange');
        usersCollection = db.collection('users');
        sessionsCollection = db.collection('sessions');
    }
}

async function createUser(user) {
    await connectToDatabase();
    try {
        // Hash the password before saving the user
        user.password = await bcrypt.hash(user.password, 10);
        return await usersCollection.insertOne(user);
    } catch (error) {
        console.error("Error creating user:", error);
        throw error;
    }
}

async function findUserByEmail(email) {
    await connectToDatabase();
    try {
        return await usersCollection.findOne({ email });
    } catch (error) {
        console.error("Error finding user by email:", error);
        throw error;
    }
}

async function updateUserVerification(userId) {
    await connectToDatabase();
    try {
        return await usersCollection.updateOne({ _id: ObjectId(userId) }, { $set: { isVerified: true } });
    } catch (error) {
        console.error("Error updating user verification:", error);
        throw error;
    }
}

async function createSession(userId) {
    await connectToDatabase();
    try {
        const session = await sessionsCollection.insertOne({
            userId: ObjectId(userId),
            createdAt: new Date()
        });
        return session;
    } catch (error) {
        console.error("Error creating session:", error);
        throw error;
    }
}

async function findUserByVerificationToken(verificationToken) {
    await connectToDatabase();
    try {
        return await usersCollection.findOne({ verificationToken });
    } catch (error) {
        console.error("Error finding user by verification token:", error);
        throw error;
    }
}


async function updateUserPassword(userId, newPassword) {
    await connectToDatabase();
    try {
        // Hash the new password before updating
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        return await usersCollection.updateOne({ _id: ObjectId(userId) }, { $set: { password: hashedPassword } });
    } catch (error) {
        console.error("Error updating user password:", error);
        throw error;
    }
}
async function findSessionById(sessionId) {
    await connectToDatabase();
    return sessionsCollection.findOne({ _id: ObjectId(sessionId) });
}

async function findUserById(userId) {
    await connectToDatabase();
    return usersCollection.findOne({ _id: ObjectId(userId) });
}

module.exports = {
    createUser,
    findUserByEmail,
    updateUserVerification,
    createSession,
    findUserByVerificationToken,
    updateUserPassword,
    findSessionById,
    findUserById
};
