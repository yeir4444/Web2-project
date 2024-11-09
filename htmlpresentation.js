const express = require("express");
const handlebars = require("express-handlebars");
const cookieParser = require("cookie-parser");
const app = express();

app.set('views', __dirname + "/templates");
app.set('view engine', 'handlebars');
