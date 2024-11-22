const csurf = require('csurf');
const business = require('./business');
const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const { engine } = require('express-handlebars');
const fileUpload= require('express-fileupload');
const app = express();


// Middleware setup
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(fileUpload());

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

app.get('/account', async (req, res) => {
    const sessionKey = req.cookies.session;

    if (!sessionKey) {
        return res.redirect('/login'); // No session key
    }

    const session = await business.getSession(sessionKey);

    if (!session || new Date(session.expiry) < new Date()) {
        return res.redirect('/login'); // Invalid or expired session
    }

    // Render account page with full user data
    const user = session.data;
    res.render('account', { user });
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
    if (!req.body._csrf || req.body._csrf !== req.csrfToken()) {
        return res.status(403).send('Forbidden: Invalid CSRF token');
    }
    
    const sessionKey = req.cookies.session;

    // Ensure user is logged in
    if (!sessionKey) {
        return res.redirect('/login');
    }

    const session = await business.getSession(sessionKey);
    if (!session) {
        return res.redirect('/login');
    }

    const username = session.data.username;

    // Check if a file is uploaded
    if (!req.files || !req.files.profilePicture) {
        return res.status(400).render('account', {
            error: 'No file uploaded. Please select a file to upload.',
            csrfToken: req.csrfToken(),
        });
    }

    const profilePicture = req.files.profilePicture;

    // Validate file type
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif'];
    const fileExtension = path.extname(profilePicture.name).toLowerCase();
    if (!allowedExtensions.includes(fileExtension)) {
        return res.status(400).render('account', {
            error: 'Invalid file type. Please upload an image file.',
            csrfToken: req.csrfToken(),
        });
    }

    // Define file upload path
    const uploadPath = path.join(__dirname, 'public/uploads', `${Date.now()}-${profilePicture.name}`);

    // Move file to upload directory
    try {
        await profilePicture.mv(uploadPath);
        const profilePicturePath = `/uploads/${Date.now()}-${profilePicture.name}`;

        // Update user's profile picture in the database
        await business.updateProfilePicture(username, profilePicturePath);

        res.redirect('/account');
    } catch (err) {
        console.error('File upload error:', err);
        return res.status(500).render('account', {
            error: 'An error occurred while uploading your file. Please try again.',
            csrfToken: req.csrfToken(),
        });
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
    const username = req.body.username; 
    const contacts = await business.getContacts(username);
    res.render('contacts', { contacts, csrfToken: req.csrfToken() });
});

app.post('/add-contact', csrfProtection, async (req, res) => {
    const { username, contactUsername } = req.body;
    const result = await business.addContact(username, contactUsername);

    if (result.error) {
        return res.render('contacts', { error: result.error, csrfToken: req.csrfToken() });
    }

    const contacts = await business.getContacts(username);
    res.render('contacts', { message: result.message, contacts, csrfToken: req.csrfToken() });
});

app.post('/send-message', csrfProtection, async (req, res) => {
    const { sender, receiver, content } = req.body;
    const result = await business.sendMessage(sender, receiver, content);

    if (result.error) {
        // Render messages view with an error
        const messages = await business.getMessages(sender, receiver);
        return res.render('messages', { error: result.error, messages, receiver, csrfToken: req.csrfToken() });
    }

    // Fetch updated messages
    const messages = await business.getMessages(sender, receiver);
    res.render('messages', { message: result.message, messages, receiver, csrfToken: req.csrfToken() });
});

app.post('/block-user', csrfProtection, async (req, res) => {
    const { username, blockedUsername } = req.body;
    const result = await business.blockUser(username, blockedUsername);

    if (result.error) {
        return res.render('contacts', { error: result.error, csrfToken: req.csrfToken() });
    }

    const contacts = await business.getContacts(username);
    res.render('contacts', { message: result.message, contacts, csrfToken: req.csrfToken() });
});

app.post('/unblock-user', csrfProtection, async (req, res) => {
    const { username, blockedUsername } = req.body;
    const result = await business.unblockUser(username, blockedUsername);

    if (result.error) {
        return res.render('contacts', { error: result.error, csrfToken: req.csrfToken() });
    }

    const contacts = await business.getContacts(username);
    res.render('contacts', { message: result.message, contacts, csrfToken: req.csrfToken() });
});

// Logout route
app.get('/logout', async (req, res) => {
    const sessionId = req.cookies.sessionId;
    if (sessionId) {
        await business.terminateSession(sessionId);
    }

    res.clearCookie("sessionId");
    res.redirect("/login");
});

// Start the server
app.listen(8000, () => console.log("Server running on port 8000"));
