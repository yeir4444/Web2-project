const express = require("express");
const handlebars = require("express-handlebars");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const business = require('./business');

const app = express();



// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());

// View engine setup
app.set('views', __dirname + "/templates");
app.set('view engine', 'handlebars');
app.engine('handlebars', handlebars({ defaultLayout: 'main' }));


// GET route for Registration
app.get('/register', (req, res) => {
    res.render('registration'); // Renders the registration form template
});


// POST Function (Handle form submission)
app.post('/register', async (req, res) => {
    const { username, email, password, confirmPassword } = req.body;

    // Check if passwords match
    if (password !== confirmPassword) {
        return res.send('Passwords do not match');
    }

    try {
        // Use the registerUser function to create a new user
        const result = await business.registerUser(username, email, password);

        // If there's an error show it otherwise, confirm success
        if (result.error) {
            res.send(result.error); // Error in registration
        } else {
            res.send(result.message); // Success message
        }
    } catch (error) {
        res.send('An error occurred. Please try again.');
    }
});


// Routes
app.get('/login', (req, res) => {
    res.render('login'); // Rendering the login page
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        let sessionId = await business.login(email, password);
        if (sessionId) {
            res.cookie('sessionId', sessionId, { httpOnly: true });
            res.redirect('/account'); // Redirect to account after successful login
        } else {
            res.status(400).send('Invalid credentials');
        }
    } catch (error) {
        res.status(500).send('Login process error');
    }
});

// Start the server
app.listen(8000, () => {
    console.log("Server running on port 8000");
});

