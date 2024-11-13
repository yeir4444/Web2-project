const express = require("express");
const { engine } = require("express-handlebars");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const csurf = require("csurf");
const business = require('./business');

const app = express();

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
    const sessionId = await business.login(email, password);

    if (sessionId) {
        res.cookie('sessionId', sessionId, { httpOnly: true });
        res.redirect('/account');
    } else {
        res.render('login', { error: 'Invalid credentials. Please try again.', csrfToken: req.csrfToken() });
    }
});

app.get('/account', async (req, res) => {
    const sessionId = req.cookies.sessionId;
    if (!sessionId) {
        return res.redirect('/login');
    }

    try {
        const user = await business.getUserBySession(sessionId);
        if (user) {
            res.render('account', { user });
        } else {
            res.clearCookie('sessionId');
            res.redirect('/login');
        }
    } catch (error) {
        res.send('An error occurred while fetching account information.');
    }
});

// Logout route
app.get('/logout', (req, res) => {
    res.clearCookie('sessionId');
    res.redirect('/login');
});

// Start the server
app.listen(8000, () => console.log("Server running on port 8000"));
