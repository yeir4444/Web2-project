const { MongoClient, ObjectId } = require("mongodb");
const crypto = require('crypto');

let client;
let db;
let usersCollection;
let sessionsCollection;
let messagesCollection;

async function connectToDatabase() {
    if (!client) {
        client = new MongoClient(''); // change this to your connection string and it should work
        await client.connect();
        db = client.db('language_exchange');
        usersCollection = db.collection('users');
        sessionsCollection = db.collection('sessions');
        messagesCollection = db.collection('messages');
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
        console.log("Finding user by email:", email); 
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

async function updateUser(username, updates) {
    await connectToDatabase();
    return await usersCollection.updateOne(
        { username },
        { $set: updates }
    );
}

async function updatePassword(key, hashedPassword) {
    await connectToDatabase();
    await usersCollection.updateOne(
        { resetkey: key },
        {
            $set: { password: hashedPassword },
            $unset: { resetkey: "", resetkeyExpiry: "" },
        }
    );
}

async function updateProfilePicture(username, profilePicturePath) {
    try {
        await connectToDatabase()
        await usersCollection.updateOne(
            { username },
            { $set: { profilePicture: profilePicturePath } }
        );
    } catch (error) {
        console.error('Error updating profile picture:', error);
        throw error;
    }
}

async function startSession(sd) {
    await connectToDatabase()
    await sessionsCollection.insertOne(sd)
}

async function updateSession(sessionKey, updatedData) {
    try {
        await connectToDatabase()
        await sessionsCollection.updateOne(
            { key: sessionKey },
            { $set: { data: updatedData } }
        );
    } catch (error) {
        console.error('Error updating session:', error);
        throw error;
    }
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
        const hash = crypto.createHash('sha256').update(user.password).digest('hex');
        user.password = hash; // Store hashed password

        user.languagesFluent = user.languagesFluent || []; // List of languages fluent in
        user.languagesToLearn = user.languagesToLearn || []; // List of languages to learn
        user.profilePicture = profilePicturePath || '';

        user.verificationToken = crypto.randomUUID();
        user.verificationTokenExpiry = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24 hours expiry
        user.verified = false;

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
    console.log("Finding user by reset token:", token); // Debug log
    return await usersCollection.findOne({ resetkey: token });
}

async function addContact(username, contactUsername) {
    await connectToDatabase();
    const user = await usersCollection.findOne({ username });
    const contact = await usersCollection.findOne({ username: contactUsername });

    if (!user || !contact) throw new Error("User not found.");
    if (user.blockedUsers?.includes(contactUsername)) throw new Error("User is blocked.");

    await usersCollection.updateOne(
        { username },
        { $addToSet: { contacts: contactUsername } } // Prevent duplicates
    );
}

async function removeContact(username, contactUsername) {
    await connectToDatabase();
    await usersCollection.updateOne(
        { username },
        { $pull: { contacts: contactUsername } } // Remove the contact
    );
}

async function sendMessage(sender, receiver, content) {
    await connectToDatabase();
    const message = {
        sender,
        receiver,
        content,
        timestamp: new Date(),
    };
    await messagesCollection.insertOne(message);
}

async function getMessages(user1, user2) {
    await connectToDatabase();
    return await messagesCollection.find({
        $or: [
            { sender: user1, receiver: user2 },
            { sender: user2, receiver: user1 },
        ],
    }).toArray();
}

async function blockUser(username, blockedUsername) {
    await connectToDatabase();
    await usersCollection.updateOne(
        { username },
        { $addToSet: { blockedUsers: blockedUsername } }
    );
}

async function unblockUser(username, blockedUsername) {
    await connectToDatabase();
    await usersCollection.updateOne(
        { username },
        { $pull: { blockedUsers: blockedUsername } }
    );
}

async function getUsers(username, userType) {
    if (userType === 'all') {
        const users = await usersCollection.find({}, { username: 1, profilePicture: 1, _id: 0 }).toArray();
        return users;
    } else if (userType === 'one') {
        return await usersCollection.findOne({ username: username }, { projection: { _id: 0, username: 1, profilePicture: 1, languagesFluent: 1, languagesLearning: 1 } });
    }
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
    findUserByResetToken,
    addContact,
    removeContact,
    sendMessage,
    getMessages,
    blockUser,
    unblockUser,
    updateProfilePicture,
    getUsers
};
