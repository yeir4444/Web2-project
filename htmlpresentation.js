const express = require("express");
const handlebars = require("express-handlebars");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const business = require('./business'); 

const app = express();

// Middleware setup
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());
     
// Set up view engine
app.set('views', __dirname + "/templates");
app.set('view engine', 'handlebars');
app.engine('handlebars', handlebars({ defaultLayout: 'main' }));

// Route to display the registration form
app.get('/registration', (req, res) => {
    res.render('registration'); // Renders the registration form template
});

// Handle form submission for registration
app.post('/registration', async (req, res) => {
    const { username, email, password, role } = req.body;

    // Basic validation: Check if passwords match
    if (password !== confirmPassword) {
        return res.send('Passwords do not match');
    }

    try {
        // Register new user
        const result = await business.registerUser(username, email, password, role);

        // Send success or error message based on the result
        if (result.error) {
            res.send(result.error); // Display error in registration
        } else {
            res.send(result.message); // Display success message
        }
    } catch (error) {
        res.send('An error occurred. Please try again.');
    }
});

// Route to display the login page
app.get('/login', (req, res) => {
    res.render('login'); // Render the login page template
});

// Handle login form submission
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // Attempt login
        let sessionId = await business.login(email, password);
        if (sessionId) {
            // Set session cookie if login is successful
            res.cookie('sessionId', sessionId, { httpOnly: true });
            res.redirect('/account'); // Redirect to account page after successful login
        } else {
            res.send('Invalid credentials'); // Show invalid credentials message
        }
    } catch (error) {
        res.send('Login process error');
    }
});

// Start the server
app.listen(8000, () => {
    console.log("Server running on port 8000");
});
