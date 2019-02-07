var express = require("express");
var app = express();
var cors = require('cors')
var cfenv = require("cfenv");
var bodyParser = require('body-parser');
var axios = require('axios');
var HTMLParser = require('fast-html-parser');


// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({
  extended: true
}))

// parse application/json
app.use(bodyParser.json())

// Enable CORS
app.use(cors())


app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header('Access-Control-Allow-Methods', 'DELETE, PUT');
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});


/* Endpoint to fetch data from Global WIne Score web site. */
app.get("/api/GWS/:appellation/:wine/:year", function (request, response) {
  var appellation = request.params.appellation;
  var wine = request.params.wine;
  var year = request.params.year;
  console.log("[NodeJS - /api/GWS]invoked with param : " + appellation + "/" + wine + "/" + year);

  var GWSUrl = "https://www.globalwinescore.com/wine-score/" + wine + "-" + appellation + "/" + year;
  var GWScore = {
    score: 0
  };
  console.log("[NodeJS - /api/GWS]" + GWSUrl);
  var _self = this;
  axios.get(GWSUrl)
    .then(res => {
      var root = HTMLParser.parse(res.data);
      let score = root.querySelector('h2.score');
      let firstNode = score.firstChild;
      let rawScoreTxt = firstNode.rawText;
      if (rawScoreTxt.search("not enough data") == -1)
        GWScore.score = parseFloat(rawScoreTxt.trim());

      console.log("[NodeJS - /api/GWS]response : " + JSON.stringify(GWScore));
      response.send(GWScore);
    })
    .catch(err => {
      if (err.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.log("[NodeJS - /api/GWS]Something went wrong - status : " + err.response.status);
        response.status(err.response.status).send(err.message);
      } else if (err.request) {
        // The request was made but no response was received
        // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
        // http.ClientRequest in node.js
        console.log("[NodeJS - /api/GWS]Something went wrong - no response from server : " + err.request);
        response.status(500).send(err.message);
      } else {
        // Something happened in setting up the request that triggered an Error
        console.log("[NodeJS - /api/GWS]Something went wrong in the NodeJs proxy: " + err.message);
        response.status(500).send(err.message);
      }
    });
});


//serve static file (index.html, images, css)
app.use(express.static(__dirname + '/../client/www'));

app.get('*', function (request, response) {
  response.sendFile('index.html', {
    root: './client/www'
  });
});


var port = process.env.PORT || 5001
app.listen(port, function () {
  console.log("To view your app, open this link in your browser: http://localhost:" + port);
});