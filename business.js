const csurf = require('csurf');
const business = require('./business');
const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const { engine } = require('express-handlebars');
const fileUpload= require('express-fileupload');
const app = express();

app.use(fileUpload());
// Middleware setup
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

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
    const user = session.data; // Assuming session.data contains { username, email, role }
    res.render('account', { user });
});

app.get('/forgot-password', csrfProtection, (req, res) => {
    res.render("forgot-password", { csrfToken: req.csrfToken() });
});


app.post('/forgot-password', csrfProtection, async (req, res) => {
    const { email } = req.body;

    // Call resetPassword from business.js
    const result = await business.resetPassword(email);
    if (result.error) {
        res.render('forgot-password', { error: result.error, csrfToken: req.csrfToken() });
    } else {
        res.send(result.message); // Send message after resetting password
    }
});


app.get('/reset-password', csrfProtection, (req, res) => {
    const token = req.query.token;
    res.render('reset-password', { csrfToken: req.csrfToken(), token });
});

app.post('/reset-password', csrfProtection, async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.render('reset-password', { error: 'Invalid request. Please try again.', csrfToken: req.csrfToken(), token });
        }

        // Find the user by reset token
        const user = await business.findUserByResetToken(token);
        if (!user || new Date(user.resetkeyExpiry) < new Date()) {
            return res.render('reset-password', { error: 'Invalid or expired reset token.', csrfToken: req.csrfToken(), token });
        }

        // Hash the new password
        const hashedPassword = await business.setPassword(token, newPassword);

        // Update the user's password and clear the reset token
        await business.updateUser(user.username, {
            password: hashedPassword,
            resetkey: null,
            resetkeyExpiry: null,
        });

        res.render('login', { message: 'Password reset successfully. Please log in.', csrfToken: req.csrfToken() });
    } catch (err) {
        console.error(err);
        res.render('reset-password', { error: 'An error occurred. Please try again.', csrfToken: req.csrfToken(), token });
    }
});

app.post('/upload-profile-picture', csrfProtection, async (req, res) => {
    // Check for valid session
    const sessionKey = req.cookies.session;

    if (!sessionKey) {
        return res.redirect('/login');
    }

    // Get the session details
    const session = await business.getSession(sessionKey);
    if (!session) {
        return res.redirect('/login');
    }

    // Get the user details associated with the session
    const user = await business.getUserDetails(session.data.username);
    if (!user) {
        return res.redirect('/login');
    }

    // Check if the file is present
    if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).send('No file uploaded. Please select a file to upload.');
    }

    // Get the uploaded file
    let profilePicture = req.files.profilePicture;

    // Define the upload path
    const uploadPath = __dirname + '/public/uploads/' + Date.now() + '-' + profilePicture.name;

    // Use the mv() method to place the file somewhere on your server
    profilePicture.mv(uploadPath, async (err) => {
        if (err) {
            return res.status(500).send(err);
        }

        // Update the user's profile with the new picture
        const profilePicturePath = `/uploads/${Date.now()}-${profilePicture.name}`;
        await business.updateProfilePicture(user.username, profilePicturePath);

        // Redirect back to the account page
        res.redirect('/account');
    });
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

