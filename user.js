const { MongoClient, ObjectId } = require("mongodb");

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

async function getUserDetails(username) {
    await connectToDatabase()
    let result = await usersCollection.findOne({username :username})
    return result
}

async function findUserByEmail(email) {
    await connectToDatabase();
    try {
        return await usersCollection.findOne({email : email });
    } catch (error) {
        console.error("Error finding user by email:", error);
        throw error;
    }
}

async function checkReset(key) {
    await connectToDatabase();
    let result = await usersCollection.findOne({resetkey: key});
    return result;
}

async function updateUser(user, updates) {
    await connectToDatabase();
    if (updates.profilePicture) {
        updates.profilePicture = updates.profilePicture;  // Update with the new profile picture path
    };
    return await usersCollection.updateOne({ username }, { $set: updates });
}

async function updatePassword(key, pw) {
    await connectToDatabase()
    const user = await usersCollection.findOne({ resetkey: key });
    if (user) {
        user.password = newPassword;
        delete user.resetkey;
        delete user.resetkeyExpiry;
        await usersCollection.replaceOne({ email: user.email }, user);
    }
}

async function startSession(sd) {
    await connectToDatabase()
    await sessionsCollection.insertOne(sd)
}

async function updateSession(key, data) {
    await connectToDatabase()
    await sessionsCollection.replaceOne({key: key}, data)
}

async function getSession(key) {
    await connectToDatabase()
    let result = await sessionsCollection.findOne({key: key})
    return result
}

async function terminateSession(key) {
    await connectToDatabase()
    await sessionsCollection.deleteOne({key: key})
}
async function createUser(user, profilePicturePath = '') {
    await connectToDatabase();
    try {
        // Hash the password using crypto's SHA-256
        const hash = crypto.createHash('sha256');
        hash.update(user.password);
        user.password = hash.digest('hex'); // Store the hashed password as a hex string

        user.verificationToken = crypto.randomUUID();
        user.verificationTokenExpiry = new Date (Date.now()+ 1000 * 60 * 50 * 24); //24 hours expiry
        // If a profile picture is provided, save the path
        if (profilePicturePath) {
            user.profilePicture = profilePicturePath; // Store the profile picture path in the user object
        }

        return await usersCollection.insertOne(user);
    } catch (error) {
        console.error("Error creating user:", error);
        throw error;
    }
}

async function verifyUser(token){
    await connectToDatabase();
    const user = await usersCollection.findOne ({
        verificationToken: token
    });
    if (user && new Date(user.verificationTokenExpiry) > new Date()){
        await usersCollection.updateOne({verificationToken: token}, { $set: {verified: true}, $unset: {
            verificationToken : "", verificationTokenExpiry: ""
        }});
        return true;
    }
    return false;
}

async function findUserByResetToken(token) {
    await connectToDatabase();
    return await usersCollection.findOne({ resetkey: token });
}
module.exports = {
    createUser,
    findUserByEmail,
    terminateSession,
    getSession,
    updateSession,
    startSession,
    updatePassword,
    updateUser,
    checkReset,
    getUserDetails,
    verifyUser,
    findUserByResetToken
};
