const { MongoClient, ObjectId } = require("mongodb");
const client = new MongoClient(process.env.MONGO_URI); //not sure about this line i googled it.
const db = client.db("language_exchange");
const usersCollection = db.collection("users");

async function createUser(user){
  await client.connect();
  return usersCollection.insertOne(user);
};
async function findUserByEmail(email){
  await client.connect();
  return usersCollection.findOne({ email });
};
async function updateUserVerification(userId){
  await client.connect();
  return usersCollection.updateOne({ _id: new ObjectId(userId) }, { $set: { isVerified: true } });
};

async function createSession(userId) {
  session = await db.collection('sessions').insertOne({
    userId: userId,
    createdAt: new Date()
  });
  return session;
}

module.exports= { createUser, 
                 findUserByEmail, 
                 updateUserVerification};
