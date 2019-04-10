var express = require("express");
var app = express();
var cors = require('cors')
var cfenv = require("cfenv");
var bodyParser = require('body-parser');
var axios = require('axios');
var HTMLParser = require('fast-html-parser');
var jwt = require('jsonwebtoken');
var crypto = require('crypto');
var https = require('https');

const secret = 'RbBQqA6uF#msRF8s7h*?@=95HUm&DgMDd6zLFn4XzWQ6dtwXSJwBX#?gL2JWf!';
const length = 128;
const digest = 'sha256';
const dbHost = 'd9b71086-9d4d-45ed-b6f8-42ffbfcbec84-bluemix.cloudant.com'
const dbHostServiceUsername = "d9b71086-9d4d-45ed-b6f8-42ffbfcbec84-bluemix";
const dbHostServicePassword = "eadc2fb095f724f11fbb3c523694d1bef8b8e09a8d88d8c15891d37c13eb90ec";
const gmail = '';
const gmailClientID = '622637269610-k895d710paiuk5oiu9rc2bppakb0sm4h.apps.googleusercontent.com';
const gmailClientPassword = 'LXU_TzSbDhgG_1uA-19OODMm';

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

// endpoint to 1. Create the user into the app-users db and 2. create a new database 'cellar${username}' into cloudant
// request body () :
// username :
// password: 
// email: 
// Optionnal : 
//    lastname: request.body.lastname || "",
//    firstname: request.body.firstname || "",
//    address: request.body.address || "",
//    phone: request.body.phone || ""
app.post("/api/register", function (request, response, next) {
  if (!request.body.hasOwnProperty('password')) {
    let err = new Error('No password');
    return next(err);
  }

  if (!request.body.hasOwnProperty('username')) {
    let err = new Error('No user name');
    return next(err);
  }

  // Check that user deosn't already exists before creating a new one
  var selector = {
    "selector": {
      "$and": [{
          "app": "mycellar"
        },
        {
          "username": request.body.username
        }
      ]
    }
  };

  axios({
      url: 'https://' + dbHost + '/app-users/_find',
      method: 'post',
      auth: {
        username: dbHostServiceUsername,
        password: dbHostServicePassword
      },
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JSON.stringify(selector))
      },
      data: selector
    }).then(res => {
      if (res.data.docs.length != 0) {
        // username already exist
        response.send("username " + request.body.username + " already exists");
      } else {
        axios.post("http://localhost:" + port + "/api/createUserInAppUsersTable", {
            data: {
              username: request.body.username,
              password: request.body.password,
              lastname: request.body.lastname || "",
              firstname: request.body.firstname || "",
              address: request.body.addres || "",
              email: request.body.email || "",
              phone: request.body.phone || ""
            }
          })
          .then(res => {
            if (res.data.doc) {
              // Call Cloudant API to create a cellar database for the user
              var url = 'https://' + dbHostServiceUsername + ":" + dbHostServicePassword + "@" + dbHost + '/cellar$' + request.body.username;
              axios(url, {
                url: url,
                method: 'put',
                auth: {
                  username: dbHostServiceUsername,
                  password: dbHostServicePassword
                }

              }).then(res => {
                response.send({
                  message: "User " + request.body.username + " registered",
                  tranlateKey: "registrationOK"
                });
              }).catch(error => {
                if (error.response) {
                  // The request was made and the server responded with a status code
                  // that falls out of the range of 2xx
                  //console.log("[NodeJS - /register /create cloudant db]Something went wrong - data : " + error.response.data);
                  console.log("[NodeJS - /register /create cloudant db]Something went wrong - status : " + error.response.status);
                  //console.log("[NodeJS - /register /create cloudant db]Something went wrong - status : " + error.response.headers);
                  response.status(error.response.status).send(error.message)
                } else if (error.request) {
                  // The request was made but no response was received
                  // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
                  // http.ClientRequest in node.js
                  console.log("[NodeJS - /register /create cloudant db]Something went wrong - request : " + error.request);
                  response.status(500).send(error.request)
                } else {
                  // Something happened in setting up the request that triggered an Error
                  console.log("[NodeJS - /register /create cloudant db]Something went wrong - message : " + error.message);
                  response.status(500).send(error.message)
                }
              });
            }
          })
          .catch(err => {
            if (err.response) {
              // The request was made and the server responded with a status code
              // that falls out of the range of 2xx
              console.log("[NodeJS - /register]Something went wrong - status : " + err.response.status);
              response.status(err.response.status).send(err.message);
            } else if (err.request) {
              // The request was made but no response was received
              // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
              // http.ClientRequest in node.js
              console.log("[NodeJS - /register]Something went wrong - no response from server : " + err.request);
              response.status(500).send(err.message);
            } else {
              // Something happened in setting up the request that triggered an Error
              console.log("[NodeJS - /register]Something went wrong in the NodeJs proxy: " + err.message);
              response.status(500).send(err.message);
            }
          });

      }
    })
    .catch(error => {
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        //console.log("[NodeJS - /register /create cloudant db]Something went wrong - data : " + error.response.data);
        console.log("[NodeJS - /register /create cloudant db]Something went wrong - status : " + error.response.status);
        //console.log("[NodeJS - /register /create cloudant db]Something went wrong - status : " + error.response.headers);
        response.status(error.response.status).send(error.message)
      } else if (error.request) {
        // The request was made but no response was received
        // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
        // http.ClientRequest in node.js
        console.log("[NodeJS - /register /create cloudant db]Something went wrong - request : " + error.request);
        response.status(500).send(error.request)
      } else {
        // Something happened in setting up the request that triggered an Error
        console.log("[NodeJS - /register /create cloudant db]Something went wrong - message : " + error.message);
        response.status(500).send(error.message)
      }
    });
});

// endpoint to 1. Create the user into the app-users db and 2. create a new database 'cellar${username}' into cloudant
// request body () :
// username :
// password: 
// email: 
// Optionnal : 
//    lastname: request.body.lastname || "",
//    firstname: request.body.firstname || "",
//    address: request.body.address || "",
//    phone: request.body.phone || ""
app.post("/api/registerViaMail", function (request, response, next) {
  if (!request.body.hasOwnProperty('password')) {
    let err = new Error('No password');
    return next(err);
  }
  if (!request.body.hasOwnProperty('username')) {
    let err = new Error('No user name');
    return next(err);
  }
  if (!request.body.hasOwnProperty('email')) {
    let err = new Error('No user email');
    return next(err);
  }

  var send = require('gmail-send')({
    //var send = require('../index.js')({
    user: 'phbucks@gmail.com',
    // user: credentials.user,                  // Your GMail account used to send emails
    pass: 'id1478965',
    // pass: credentials.pass,                  // Application-specific password
    //to: 'user@gmail.com',
    // to:   credentials.user,                  // Send to yourself
    // you also may set array of recipients:
    // [ 'user1@gmail.com', 'user2@gmail.com' ]
    // from:    credentials.user,            // from: by default equals to user
    // replyTo: credentials.user,            // replyTo: by default undefined
    // bcc: 'some-user@mail.com',            // almost any option of `nodemailer` will be passed to it
    subject: 'test subject',
    text: 'gmail-send example 1', // Plain text
    //html:    '<b>html text</b>'            // HTML
  });

  send({
    to: 'philippe.destrais@gmail.com',
    subject: 'Mycellar registration',
    text: 'username: ' + request.body.username + '\npassword: ' + request.body.password + '\nemail: ' + request.body.email + '\n: ' + request.body.email + '\nfirst name: ' + request.body.firstName + '\nlast name: ' + request.body.lastName
  }, function (err, res) {
    if (err != null) {
      console.log('gmail send message call error returned')
      response.status(500).send(err)
    } else {
      console.log("gmail send message call returned without error");
      response.send({
        result: 'OK'
      })
    }
    console.log('send() callback returned: err:', err, '; res:', res);
  });
});

/* Endpoint to fetch data from Global WIne Score web site. */
app.post("/api/createUserInAppUsersTable", function (request, response, next) {
  if (!request.body.data.hasOwnProperty('password')) {
    let err = new Error('No password');
    return next(err);
  }

  if (!request.body.data.hasOwnProperty('username')) {
    let err = new Error('No user name');
    return next(err);
  }

  const salt = crypto.randomBytes(128).toString('base64');

  var hashedPw;
  try {
    hashedPw = crypto.pbkdf2Sync(request.body.data.password, salt, 10000, length, digest);
  } catch (err) {
    response.status(500).json({
      error: err
    });
  }
  //store user credentials (user,password,salt and other required info) into the database
  var reqData = {
    app: "mycellar",
    username: request.body.data.username,
    password: hashedPw.toString('hex'),
    salt: salt,
    lastname: request.body.data.lastname || "",
    firstname: request.body.data.firstname || "",
    address: request.body.data.addres || "",
    email: request.body.data.email || "",
    phone: request.body.data.phone || "",
    admin: false
  };
  var options = {
    host: dbHost,
    path: '/app-users',
    method: 'POST',
    rejectUnauthorized: false,
    auth: dbHostServiceUsername + ":" + dbHostServicePassword,
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(JSON.stringify(reqData))
    }
  };
  console.log('/registration data:', JSON.stringify(reqData));

  var req = https.request(options, (res) => {
    //console.log('statusCode:', res.statusCode);
    //console.log('headers:', res.headers);
    var body = '';
    res.on('data', (d) => {
      body += d;
      process.stdout.write(d);
    });
    res.on('end', function () {
      // Data reception is done, do whatever with it!
      //console.log("before parsing - body : "+body);
      var parsed = {};
      try {
        parsed = JSON.parse(body);
      } catch (e) {
        parsed = {};
        console.log("error parsing result");
      }
      response.json({
        doc: parsed
      });
    });
  });

  req.on('error', (e) => {
    console.error("Node Server Request got error: " + e.message);
  });
  req.write(JSON.stringify(reqData));
  req.end();
});

// login method
// request body :
// username :
// password : 
app.post('/api/login', function (request, response, next) {

  // get user credentials from the database
  var selector = {
    "selector": {
      "$and": [{
          "app": "mycellar"
        },
        {
          "username": request.body.username
        }
      ]
    }
  };

  var options = {
    host: dbHost,
    path: '/app-users/_find',
    method: 'POST',
    rejectUnauthorized: false,
    auth: dbHostServiceUsername + ":" + dbHostServicePassword,
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(JSON.stringify(selector))
    }
  };
  console.log('/login selector :', JSON.stringify(selector));

  var req = https.request(options, (res) => {
    //console.log('statusCode:', res.statusCode);
    //console.log('headers:', res.headers);
    var body = '';
    res.on('data', (d) => {
      body += d;
      process.stdout.write(d);
    });
    res.on('end', function () {
      // Data reception is done, do whatever with it!
      //console.log("before parsing - body : "+body);
      var parsed = {};
      try {
        parsed = JSON.parse(body);
        var user = parsed.docs[0];
        if (user) {
          // verify that the password stored in the database corresponds to the given password
          var hash;
          try {
            hash = crypto.pbkdf2Sync(request.body.password, user.salt, 10000, length, digest);
          } catch (e) {
            response.json({
              error: e
            });
          }
          // check if password is correct by recalculating hash on password and comparing with stored value
          if (hash.toString('hex') === user.password) {
            console.log("password is correct");
            const token = jwt.sign({
              'user': user.username,
              permissions: []
            }, secret, {
              expiresIn: '30d'
            });
            user.token = token;
            delete user.salt;
            response.json(user);

          } else {
            response.json({
              message: 'Wrong password',
              translateKey: 'BadPassword'
            });
          }
        } else {
          response.json({
            message: "username doesn't exist",
            translateKey: 'NoUsername'
          })
        }
      } catch (e) {
        parsed = {};
        console.log("error parsing result");
      }
      //response.json({
      //  doc: parsed
      //});
    });
  });

  req.on('error', (e) => {
    console.error("Node Server Request got error: " + e.message);
  });
  req.write(JSON.stringify(selector));
  req.end();

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