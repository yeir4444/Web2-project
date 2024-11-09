const { MongoClient, ObjectId } = require("mongodb");
const client = new MongoClient(process.env.MONGO_URI); //not sure about this line i googled it.
const db = client.db("language_exchange");
const usersCollection = db.collection("users");

const createUser = async (user) => {
  await client.connect();
  return usersCollection.insertOne(user);
};
const findUserByEmail = async (email) => {
  await client.connect();
  return usersCollection.findOne({ email });
};
const updateUserVerification = async (userId) => {
  await client.connect();
  return usersCollection.updateOne({ _id: new ObjectId(userId) }, { $set: { isVerified: true } });
};

module.exports= { createUser, 
                 findUserByEmail, 
                 updateUserVerification};
