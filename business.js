const user = require('./user') // persistence layer

async function login(email, password) {
    let user = await user.findUserByEmail(email);
    if (user && user.password == password) {
        let session = await user.createSession(user._id);
        return session.insertedId;
    }
    return null;
}

module.exports = {
    login
}
