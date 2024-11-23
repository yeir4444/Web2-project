const csurf = require('csurf');
const business = require('./business');
const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const { engine } = require('express-handlebars');
const fileUpload = require('express-fileupload');
const path = require('path');


const app = express();


// Middleware setup
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(fileUpload({ limits: { fileSize: 2 * 1024 * 1024 } })); // 2MB limit
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Static folder for CSS and other assets
app.use(express.static(__dirname + '/public'));

// Setting up CSRF protection
const csrfProtection = csurf({ cookie: true });
app.use(csrfProtection);

// Setting up view engine
app.engine('handlebars', engine({ defaultLayout: 'layout' }));
app.set('view engine', 'handlebars');
app.set('views', __dirname + "/templates");

// Redirecting root to login
app.get('/', (req, res) => res.redirect('/login'));

// Routes
app.get('/registration', csrfProtection, (req, res) => {
    res.render('registration', { csrfToken: req.csrfToken() });
});

app.post('/registration', csrfProtection, async (req, res) => {
    const { username, email, password, confirmPassword, role } = req.body;

    if (password !== confirmPassword) {
        return res.render('registration', { error: 'Passwords do not match', csrfToken: req.csrfToken() });
    }

    const result = await business.registerUser(username, email, password, role);
    if (result.error) {
        res.render('registration', { error: result.error, csrfToken: req.csrfToken() });
    } else {
        res.render('registration', { message: result.message, csrfToken: req.csrfToken() });
    }
});

app.get('/login', csrfProtection, (req, res) => res.render('login', { csrfToken: req.csrfToken() }));

app.post('/login', csrfProtection, async (req, res) => {
    const { email, password } = req.body;

    // Call the business layer login function
    const session = await business.login(email, password);

    if (session.error) {
        return res.render('login', { error: session.error, csrfToken: req.csrfToken() });
    }

    // Set session cookie
    res.cookie('session', session.key, { expires: session.expiry, httpOnly: true });
    res.redirect('/account');
});

app.get('/account', csrfProtection, async (req, res) => {
    const sessionKey = req.cookies.session;
    if (!sessionKey) return res.redirect('/login');

    const session = await business.getSession(sessionKey);
    if (!session) return res.redirect('/login');

    const allUsers = await business.getContacts('', 'all');
    
    res.render('account', { 
        user: session.data,
        usersList: allUsers,
        csrfToken: req.csrfToken()
    });
});

app.get('/profile/:username', csrfProtection, async (req, res) => {
    const username = req.params.username;
    
    // Fetch the user data based on the username
    const user = await business.getContacts(username, 'one');
    if (!user) {
        return res.status(404).send('User not found');
    }
    console.log(await user);
    
    res.render('userProfile', { 
        user: user,
        csrfToken: req.csrfToken()
    });
});

app.post('/update-languages', csrfProtection, async (req, res) => {
    try {
        const { fluentLanguages, languagesToLearn } = req.body;
        const sessionKey = req.cookies.session;

        // Validate session
        if (!sessionKey) return res.redirect('/login');

        const session = await business.getSession(sessionKey);
        if (!session) return res.redirect('/login');

        const username = session.data.username;

        // Update the user's languages
        await business.updateLanguages(username, fluentLanguages, languagesToLearn);

        res.redirect('/account'); // Redirect back to the account page
    } catch (error) {
        console.error('Error updating languages:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/forgot-password', csrfProtection, (req, res) => {
    res.render("forgot-password", { csrfToken: req.csrfToken() });
});

app.post('/forgot-password', csrfProtection, async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.render('forgot-password', {
            error: 'Email is required to reset password.',
            csrfToken: req.csrfToken(),
        });
    }

    const result = await business.resetPassword(email);

    if (result.error) {
        return res.render('forgot-password', { error: result.error, csrfToken: req.csrfToken() });
    }

    res.render('forgot-password', {
        message: result.message, // Message: "Password reset link sent successfully"
        csrfToken: req.csrfToken(),
    });
});

app.get('/reset-password', csrfProtection, async (req, res) => {
    const { token } = req.query;

    if (!token) {
        return res.render('reset-password', {
            error: 'Invalid reset link.',
            csrfToken: req.csrfToken(),
        });
    }

    const user = await business.findUserByResetToken(token);
    if (!user || new Date(user.resetkeyExpiry) < new Date()) {
        return res.render('reset-password', {
            error: 'Invalid or expired reset token.',
            csrfToken: req.csrfToken(),
        });
    }

    res.render('reset-password', { csrfToken: req.csrfToken(), token });
});

app.post('/reset-password', csrfProtection, async (req, res) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword || newPassword.trim().length === 0) {
        return res.render('reset-password', {
            error: 'Invalid request. Please ensure all fields are filled.',
            csrfToken: req.csrfToken(),
            token,
        });
    }

    const user = await business.findUserByResetToken(token);
    if (!user || new Date(user.resetkeyExpiry) < new Date()) {
        return res.render('reset-password', {
            error: 'Invalid or expired reset token.',
            csrfToken: req.csrfToken(),
        });
    }

    try {
        await business.setPassword(token, newPassword);
        res.render('login', {
            message: 'Password reset successfully. Please log in.',
            csrfToken: req.csrfToken(),
        });
    } catch (err) {
        console.error(err);
        res.render('reset-password', {
            error: 'An error occurred while resetting your password.',
            csrfToken: req.csrfToken(),
            token,
        });
    }
});

app.post('/upload-profile-picture', csrfProtection, async (req, res) => {
    try {
        const sessionKey = req.cookies.session;
        if (!sessionKey) return res.redirect('/login');

        // Get session and user data
        const session = await business.getSession(sessionKey);
        if (!session) return res.redirect('/login');

        const username = session.data.username;

        // Validate uploaded file
        if (!req.files || !req.files.profilePicture) {
            return res.status(400).render('account', {
                error: 'No file uploaded. Please select a file to upload.',
                csrfToken: req.csrfToken(),
                user: session.data
            });
        }

        const profilePicture = req.files.profilePicture;
        const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif'];
        const fileExtension = path.extname(profilePicture.name).toLowerCase();

        if (!allowedExtensions.includes(fileExtension)) {
            return res.status(400).render('account', {
                error: 'Invalid file type. Please upload an image file.',
                csrfToken: req.csrfToken(),
                user: session.data
            });
        }

        // Save the uploaded file
        const uniqueFileName = `${Date.now()}-${crypto.randomUUID()}${fileExtension}`;
        const uploadPath = path.join(__dirname, 'public/uploads', uniqueFileName);
        await profilePicture.mv(uploadPath);

        // Update the user's profile picture in the database
        const relativePath = `/uploads/${uniqueFileName}`;
        await business.updateProfilePicture(username, relativePath);

        // Update the session data with the new profile picture
        session.data.profilePicture = relativePath;
        await business.updateSession(sessionKey, session.data);

        // Render the updated account page
        res.render('account', {
            user: session.data,
            message: 'Profile picture updated successfully!',
            csrfToken: req.csrfToken()
        });
    } catch (err) {
        console.error("Error uploading profile picture:", err);
        res.status(500).send("Internal Server Error");
    }
});



app.get('/verify', async (req, res) => {
    const token = req.query.token;
    const result = await business.verifyUser(token);

    if (result.error) {
        res.render('verification', { error: result.error });
    } else {
        res.render('verification', { message: result.message });
    }
});

app.get('/contacts', csrfProtection, async (req, res) => {
    try {
        const sessionKey = req.cookies.session;

        if (!sessionKey) return res.redirect('/login');

        const session = await business.getSession(sessionKey);
        if (!session) return res.redirect('/login');

        const username = session.data.username;
        const contacts = await business.getContacts(username, 'contacts');

        if (contacts.error) {
            return res.render('contacts', { error: contacts.error, csrfToken: req.csrfToken() });
        }

        res.render('contacts', { contacts, csrfToken: req.csrfToken() });
    } catch (error) {
        console.error("Error fetching contacts:", error);
        res.status(500).send("Internal Server Error");
    }
});


app.post('/add-contact', csrfProtection, async (req, res) => {
    try {
        const { contactUsername } = req.body;
        const sessionKey = req.cookies.session;

        if (!sessionKey) return res.redirect('/login');

        const session = await business.getSession(sessionKey);
        if (!session) return res.redirect('/login');

        const username = session.data.username;
        const result = await business.addContact(username, contactUsername);

        const contacts = await business.getContacts(username, 'contacts');
        res.render('contacts', { message: result.message || result.error, contacts, csrfToken: req.csrfToken() });
    } catch (error) {
        console.error("Error adding contact:", error);
        res.status(500).send("Internal Server Error");
    }
});

app.post('/remove-contact', csrfProtection, async (req, res) => {
    try {
        const { contactUsername } = req.body;
        const sessionKey = req.cookies.session;

        if (!sessionKey) return res.redirect('/login');

        const session = await business.getSession(sessionKey);
        if (!session) return res.redirect('/login');

        const username = session.data.username;
        const result = await business.removeContact(username, contactUsername);

        const contacts = await business.getContacts(username, 'contacts');
        res.render('contacts', { message: result.message || result.error, contacts, csrfToken: req.csrfToken() });
    } catch (error) {
        console.error("Error removing contact:", error);
        res.status(500).send("Internal Server Error");
    }
});


app.get('/messages', csrfProtection, async (req, res) => {
    try {
        const sessionKey = req.cookies.session;

        if (!sessionKey) return res.redirect('/login');

        const session = await business.getSession(sessionKey);
        if (!session) return res.redirect('/login');

        const username = session.data.username;
        const { receiver } = req.query;

        if (receiver) {
            // Fetch messages with the selected contact
            const result = await business.getMessages(username, receiver);
            res.render('messages', {
                contactName: receiver,
                messages: result.messages || [],
                csrfToken: req.csrfToken()
            });
        } else {
            // Show the contact list
            const contacts = await business.getContacts(username, 'contacts');
            res.render('messages', { contacts, csrfToken: req.csrfToken() });
        }
    } catch (error) {
        console.error("Error fetching messages:", error);
        res.status(500).send("Internal Server Error");
    }
});

app.post('/send-message', csrfProtection, async (req, res) => {
    try {
        const { content, receiver } = req.body;
        const sessionKey = req.cookies.session;

        if (!sessionKey) return res.redirect('/login');

        const session = await business.getSession(sessionKey);
        if (!session) return res.redirect('/login');

        const sender = session.data.username;
        const result = await business.sendMessage(sender, receiver, content);

        if (result.error) {
            return res.redirect(`/messages?receiver=${receiver}`);
        }

        res.redirect(`/messages?receiver=${receiver}`);
    } catch (error) {
        console.error("Error sending message:", error);
        res.status(500).send("Internal Server Error");
    }
});

app.get('/manage-contacts', csrfProtection, async (req, res) => {
    try {
        const sessionKey = req.cookies.session;

        if (!sessionKey) return res.redirect('/login');

        const session = await business.getSession(sessionKey);
        if (!session) return res.redirect('/login');

        const username = session.data.username;

        // Fetch contacts and block status
        const contacts = await business.getContacts(username, 'contacts');
        const blockedUsers = session.data.blockedUsers || [];

        // Add block status to each contact
        const contactsWithBlockStatus = contacts.map(contact => ({
            ...contact,
            isBlocked: blockedUsers.includes(contact.username)
        }));

        res.render('manage-contacts', { contacts: contactsWithBlockStatus, csrfToken: req.csrfToken() });
    } catch (error) {
        console.error("Error fetching manage-contacts page:", error);
        res.status(500).send("Internal Server Error");
    }
});

app.post('/block-user', csrfProtection, async (req, res) => {
    try {
        const { blockedUsername } = req.body;
        const sessionKey = req.cookies.session;

        if (!sessionKey) return res.redirect('/login');

        const session = await business.getSession(sessionKey);
        if (!session) return res.redirect('/login');

        const username = session.data.username;
        await business.blockUser(username, blockedUsername);

        res.redirect('/manage-contacts');
    } catch (error) {
        console.error("Error blocking user:", error);
        res.status(500).send("Internal Server Error");
    }
});

app.post('/unblock-user', csrfProtection, async (req, res) => {
    try {
        const { blockedUsername } = req.body;
        const sessionKey = req.cookies.session;

        if (!sessionKey) return res.redirect('/login');

        const session = await business.getSession(sessionKey);
        if (!session) return res.redirect('/login');

        const username = session.data.username;
        await business.unblockUser(username, blockedUsername);

        res.redirect('/manage-contacts');
    } catch (error) {
        console.error("Error unblocking user:", error);
        res.status(500).send("Internal Server Error");
    }
});


app.get('/home', csrfProtection, (req, res) => {
    res.render('home', { csrfToken: req.csrfToken(), user: req.user });
});

app.get('/features', async (req, res) => {
    const sessionKey = req.cookies.session;

    if (!sessionKey) {
        return res.redirect('/login');
    }

    const session = await business.getSession(sessionKey);
    if (!session) {
        return res.redirect('/login');
    }

    const user = session.data; // Assuming `session.data` contains user details

    res.render('features', { user });
});

app.get('/badges', csrfProtection, async (req, res) => {
    try {
        const sessionKey = req.cookies.session;

        if (!sessionKey) return res.redirect('/login');

        const session = await business.getSession(sessionKey);
        if (!session) return res.redirect('/login');

        const username = session.data.username;

        // Fetch user details, including badges
        const user = await business.getSession(sessionKey);
        const badges = user?.data?.badges || [];

        res.render('badges', { badges, csrfToken: req.csrfToken() });
    } catch (error) {
        console.error("Error fetching badges:", error);
        res.status(500).send("Internal Server Error");
    }
});

app.post('/assign-badges', csrfProtection, async (req, res) => {
    try {
        const sessionKey = req.cookies.session;

        if (!sessionKey) return res.redirect('/login');

        const session = await business.getSession(sessionKey);
        if (!session) return res.redirect('/login');

        const username = session.data.username;

        // Call the assignBadges function
        await business.assignBadges(username);

        res.render('badges', { message: "Badges assigned successfully!", csrfToken: req.csrfToken() });
    } catch (error) {
        console.error("Error assigning badges:", error);
        res.status(500).send("Internal Server Error");
    }
});

// Logout route
app.get('/logout', async (req, res) => {
    const sessionId = req.cookies.sessionId;
    if (sessionId) {
        await business.terminateSession(sessionId);
    }

    res.clearCookie("session");
    res.redirect("/login");
});

// Start the server
app.listen(8000, () => console.log("Server running on port 8000"));
