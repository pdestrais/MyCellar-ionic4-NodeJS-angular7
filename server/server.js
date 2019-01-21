var express = require("express");
var app = express();
var cors = require('cors')
var cfenv = require("cfenv");
var bodyParser = require('body-parser');
var axios = require('axios');
var HTMLParser = require('fast-html-parser');


// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }))

// parse application/json
app.use(bodyParser.json())

// Enable CORS
app.use(cors())

 
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header('Access-Control-Allow-Methods', 'DELETE, PUT');
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

//serve static file (index.html, images, css)
app.use(express.static(__dirname + '/../client/www'));

app.get('*', function(request, response) {
  response.sendFile('index.html', {root: 'client/www'});
});


var port = process.env.PORT || 5001
app.listen(port, function() {
    console.log("To view your app, open this link in your browser: http://localhost:" + port);
});
