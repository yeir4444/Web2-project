const { MongoClient, ObjectId } = require("mongodb");

let client;
let db;
let usersCollection;
let sessionsCollection;

async function connectToDatabase() {
    if (!client) {
        client = new MongoClient(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
        await client.connect();
        db = client.db("language_exchange");
        usersCollection = db.collection("users");
        sessionsCollection = db.collection("sessions");
    }
}

async function createUser(user) {
    await connectToDatabase();
    return usersCollection.insertOne(user);
}

async function findUserByEmail(email) {
    await connectToDatabase();
    return usersCollection.findOne({ email });
}

async function updateUserVerification(userId) {
    await connectToDatabase();
    return usersCollection.updateOne({ _id: new ObjectId(userId) }, { $set: { isVerified: true } });
}

async function createSession(userId) {
    await connectToDatabase();
    const session = await sessionsCollection.insertOne({
        userId: new ObjectId(userId),
        createdAt: new Date()
    });
    return session;
}

async function findUserByVerificationToken(verificationToken) {
    await connectToDatabase();
    return usersCollection.findOne({ verificationToken });
}

async function updateUserPassword(userId, newPassword) {
    await connectToDatabase();
    return usersCollection.updateOne({ _id: new ObjectId(userId) }, { $set: { password: newPassword } });
}

module.exports= { createUser, 
                 findUserByEmail, 
                 updateUserVerification,
                 createSession,
                 findUserByVerificationToken,
                 updateUserPassword
                };
