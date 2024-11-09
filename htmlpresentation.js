const express = require("express");
const handlebars = require("express-handlebars");
const cookieParser = require("cookie-parser");
const app = express();

app.set('views', __dirname + "/templates");
app.set('view engine', 'handlebars');

app.get('/login', (req, res) => {
    // Rendering the login page
    res.render('login');
})

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    
    try {
        let sessionId = await business.login(email, password);
        if (sessionId) {
            res.cookie('sessionId', sessionId, {httpOnly: true});
            res.send('Login successful');
            res.redirect('/account');
        }
        else {
            res.status(400).send('Invalid credentials')
            res.redirect('/login');
        }
    }
    catch (error) {
        res.status(500).send('Login process error');
        res.redirect('/login');
    }
});

app.listen(8000, () => {
    console.log("Server running on port 8000");
});
