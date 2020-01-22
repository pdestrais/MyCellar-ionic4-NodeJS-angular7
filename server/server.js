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
var dotenv = require('dotenv')
  .config();

const length = 128;
const digest = 'sha256';
const gmail = '';

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({
  extended: true
}))

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

/* Endpoint to fetch data from Global WIne Score web site. */
app.get("/api/GWS/:appellation/:wine/:year", function(request, response) {
  var appellation = request.params.appellation;
  var wine = request.params.wine;
  var year = request.params.year;
  console.log("[NodeJS - /api/GWS]invoked with param : " + appellation + "/" + wine + "/" +
    year);

  var GWSUrl = "https://www.globalwinescore.com/wine-score/" + wine + "-" + appellation + "/" +
    year;
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
        console.log("[NodeJS - /api/GWS]Something went wrong - status : " + err.response
          .status);
        response.status(err.response.status)
          .send(err.message);
      } else if (err.request) {
        // The request was made but no response was received
        // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
        // http.ClientRequest in node.js
        console.log("[NodeJS - /api/GWS]Something went wrong - no response from server : " +
          err.request);
        response.status(500)
          .send(err.message);
      } else {
        // Something happened in setting up the request that triggered an Error
        console.log("[NodeJS - /api/GWS]Something went wrong in the NodeJs proxy: " + err
          .message);
        response.status(500)
          .send(err.message);
      }
    });
});

/* Private endpoint to create user requests (registration or password reset) in user management table. 
    Request body :
    - type(mandatory): either 'Registration' or 'passwordReset'
    - username (mandatory)
    - email
    - optional :
      - firstname
      - lastname
      - phone 
      - address
*/
app.post("/api/createUserMngmtRequest", function(request, response, next) {
  if (!request.body.hasOwnProperty('type') || (request.body.type != 'registration' && request
      .body.type != 'passwordReset')) {
    return response.status(400)
      .send({
        error: {
          type: 'wrong request parameters',
          title: 'No or invalid type'
        }
      });
  }

  if (!request.body.hasOwnProperty('username')) {
    return response.status(400)
      .send({
        error: {
          type: 'missing request parameters',
          title: 'No username'
        }
      });
  }

  if (!request.body.hasOwnProperty('email')) {
    return response.status(400)
      .send({
        error: {
          type: 'missing request parameters',
          title: 'No email'
        }
      });
  }

  //store user credentials (user,password,salt and other required info) into the database
  var reqData = {
    app: "mycellar",
    type: request.body.type,
    userName: request.body.username,
    email: request.body.email,
    lastName: request.body.lastname || "",
    firstName: request.body.firstname || "",
    address: request.body.addres || "",
    phone: request.body.phone || "",
    requestDate: new Date()
      .toISOString
  };
  console.log('/createUserMngmtRequest user request data:', JSON.stringify(reqData));
  axios({
      url: 'https://' + process.env.dbHost + '/user-mngt-app',
      method: 'post',
      auth: {
        username: process.env.dbHostServiceUsername,
        password: process.env.dbHostServicePassword
      },
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JSON.stringify(reqData))
      },
      data: reqData
    })
    .then(res => response.send({
      token: res.data.id
    }))
    .catch(err => {
      if (err.response) {
        // The request was made and the server responded with a status code that falls out of the range of 2xx
        console.log("[NodeJS - api/createUserMngmtRequest]Something went wrong - status : " +
          err.response.status);
        response.status(err.response.status)
          .send({
            error: {
              type: 'server request error',
              title: err.message
            }
          });
      } else if (err.request) {
        // The request was made but no response was received `error.request` is an instance of XMLHttpRequest in the browser and an instance of
        // http.ClientRequest in node.js
        console.log(
          "[NodeJS - api/createUserMngmtRequest]Something went wrong - no response from server : " +
          err.request);
        response.status(500)
          .send({
            error: {
              type: 'server request error',
              title: err.message
            }
          });
      } else {
        // Something happened in setting up the request that triggered an Error
        console.log(
          "[NodeJS - api/createUserMngmtRequest]Something went wrong in the NodeJs proxy: " +
          err.message);
        response.status(500)
          .send({
            error: {
              type: 'server request error',
              title: err.message
            }
          });
      }
    });
});

// Private endpoint to send a mail to the requestor. 
// request body () :
// - to (mandatory)
// - from (optional)
// - subject (mandatory)
// - message (mandatory)
app.post("/api/sendEMail", function(request, response, next) {
  if (!request.body.hasOwnProperty('subject')) {
    return response.status(400)
      .send({
        error: {
          type: 'missing request parameters',
          title: 'No subject'
        }
      });
  }
  if (!request.body.hasOwnProperty('message')) {
    return response.status(400)
      .send({
        error: {
          type: 'missing request parameters',
          title: 'No message'
        }
      });
  }
  if (!request.body.hasOwnProperty('to')) {
    return response.status(400)
      .send({
        error: {
          type: 'missing request parameters',
          title: 'No user email'
        }
      });
  }

  var send = require('gmail-send')({
    //var send = require('../index.js')({
    user: process.env.gmailUserId,
    // user: credentials.user,                  // Your GMail account used to send emails
    pass: process.env.gmailUserPwd,
    // pass: credentials.pass,                  // Application-specific password
    //to: 'user@gmail.com',
    // to:   credentials.user,                  // Send to yourself
    // you also may set array of recipients:
    // [ 'user1@gmail.com', 'user2@gmail.com' ]
    // from:    credentials.user,            // from: by default equals to user
    // replyTo: credentials.user,            // replyTo: by default undefined
    // bcc: 'some-user@mail.com',            // almost any option of `nodemailer` will be passed to it
    subject: request.body.subject,
    text: request.body.message, // Plain text
    //html:    '<b>html text</b>'            // HTML
  });

  send({
    user: process.env.gmailUserId,
    pass: process.env.gmailUserPwd,
    to: request.body.to,
    from: request.body.from || process.env.gmailUserId,
    subject: request.body.subject,
    text: request.body.message
  }, function(err, res) {
    if (err != null) {
      console.log('gmail send message call error returned')
      response.status(500)
        .send(err)
    } else {
      console.log("gmail send message call returned without error");
      response.send({
        result: 'OK'
      })
    }
    console.log('send() callback returned: err:', err, '; res:', res);
  });
});

/* Private endpoint to insert or update user data (including password) in the user table.
    Request body :
    - username (mandatory)
    - action (mandatory : either 'create' or 'update')
    - (mandatory) either 
      - password 
      or any of :
      - email
      - firstname
      - lastname
      - phone
      - address
 */
app.post("/api/upsertUserData", function(request, response, next) {

  if (!request.body.hasOwnProperty('username')) {
    return response.status(400)
      .send({
        error: {
          type: 'missing request parameters',
          title: 'No username'
        }
      });
  }

  if (!request.body.hasOwnProperty('action') || (request.body.action != 'create' && request.body
      .action != 'update')) {
    return response.status(400)
      .send({
        error: {
          type: 'wrong request parameters',
          title: 'No or invalid action'
        }
      });
  }

  if (!request.body.hasOwnProperty('password') &&
    !(request.body.hasOwnProperty('email') ||
      request.body.hasOwnProperty('firstname') ||
      request.body.hasOwnProperty('lastname') ||
      request.body.hasOwnProperty('phone') ||
      request.body.hasOwnProperty('address') ||
      request.body.hasOwnProperty('state'))
  ) {
    return response.status(400)
      .send({
        error: {
          type: 'wrong request parameters',
          title: 'No password or no other user data to update'
        }
      });
  }

  // fetch user from users table for update
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
      url: 'https://' + process.env.dbHost + '/app-users/_find',
      method: 'post',
      auth: {
        username: process.env.dbHostServiceUsername,
        password: process.env.dbHostServicePassword
      },
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JSON.stringify(selector))
      },
      data: selector
    })
    .then(res => {
      if (res.data.docs.length != 0) {
        // username exists => we can update it but not create it again ...
        if (request.body.action == 'create') {
          return response.status(400)
            .send({
              error: {
                type: 'data duplication',
                title: 'Impossible to create because this username already exists'
              }
            });
        } else {
          // this is an update
          var reqData = {
            app: "mycellar",
            username: request.body.username,
            _id: res.data.docs[0]._id,
            _rev: res.data.docs[0]._rev,
            lastname: request.body.lastname || res.data.docs[0].lastname,
            firstname: request.body.firstname || res.data.docs[0].firstname,
            address: request.body.address || res.data.docs[0].address,
            email: request.body.email || res.data.docs[0].email,
            phone: request.body.phone || res.data.docs[0].phone,
            admin: false,
            state: request.body.state || request.body.data.state
          };

          if (request.body.hasOwnProperty('password')) {
            // If a new password is given, it overwrites the existing one
            var test = crypto.randomBytes(128);
            const salt = crypto.randomBytes(128)
              .toString('base64');
            var hashedPw;
            try {
              hashedPw = crypto.pbkdf2Sync(request.body.password, salt, 10000, length,
                digest);
            } catch (err) {
              return response.status(500)
                .json({
                  error: err
                });
            }
            //store user credentials (user,password,salt and other required info) into the database
            reqData.salt = salt;
            reqData.password = hashedPw.toString('hex');
          } else {
            // If no password is given, this is just an regular update and only the changes of the passed attributes are updated
            reqData.salt = res.data.docs[0].salt;
            reqData.password = res.data.docs[0].password;
          }

          console.log('/upsertUserData update reqData:', JSON.stringify(reqData));
          axios({
              url: 'https://' + process.env.dbHost + '/app-users/' + res.data.docs[0]._id,
              method: 'PUT',
              auth: {
                username: process.env.dbHostServiceUsername,
                password: process.env.dbHostServicePassword
              },
              headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(JSON.stringify(reqData))
              },
              data: reqData
            })
            .then(res => response.json(res.data))
        }

      } else {
        // username doesn't exist => we will create it...
        if (request.body.action == 'create') {
          var reqData = {
            app: "mycellar",
            username: request.body.username,
            lastname: request.body.lastname || res.data.docs[0].lastname,
            firstname: request.body.firstname || res.data.docs[0].firstname,
            address: request.body.address || res.data.docs[0].address,
            email: request.body.email || res.data.docs[0].email,
            phone: request.body.phone || res.data.docs[0].phone,
            admin: false,
            state: request.body.state || request.body.data.state
          };
          if (request.body.hasOwnProperty('password')) {
            // If password is transfered, it overwrites the existing one
            // a new password is given
            const salt = crypto.randomBytes(128)
              .toString('base64');
            var hashedPw;
            try {
              hashedPw = crypto.pbkdf2Sync(request.body.password, salt, 10000, length,
                digest);
            } catch (err) {
              response.status(500)
                .json({
                  error: err
                });
            }
            //store user credentials (user,password,salt and other required info) into the database
            reqData.salt = salt;
            reqData.password = hashedPw.toString('hex');
          } else {
            // If no password is given, this is just an regular update and only the changes passed attributes are updated
            reqData.salt = res.data.docs[0].salt;
            reqData.password = es.data.docs[0].password;
          }
          console.log('/upsertUserData create reqData:', JSON.stringify(reqData));
          axios({
              url: 'https://' + process.env.dbHost + '/app-users',
              method: 'POST',
              auth: {
                username: process.env.dbHostServiceUsername,
                password: process.env.dbHostServicePassword
              },
              headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(JSON.stringify(reqData))
              },
              data: reqData
            })
            .then(res => response.json(res.data))
        } else {
          return response.status(401)
            .send({
              error: {
                type: 'Missing data',
                title: "User to update doesn't exist"
              }
            });
        }
      }
    })
    .catch(error => {
      if (error.response) {
        // The request was made and the server responded with a status code that falls out of the range of 2xx
        //console.log("[NodeJS - /register /create cloudant db]Something went wrong - data : " + error.response.data);
        console.log("[NodeJS - /upsertUserData api]Something went wrong - status : " + error
          .response.status);
        //console.log("[NodeJS - /register /create cloudant db]Something went wrong - status : " + error.response.headers);
        response.status(error.response.status)
          .send(error.message)
      } else if (error.request) {
        // The request was made but no response was received `error.request` is an instance of XMLHttpRequest in the browser and an instance of
        // http.ClientRequest in node.js
        console.log("[NodeJS - /upsertUserData api]Something went wrong - request : " + error
          .request);
        response.status(500)
          .send(error.request)
      } else {
        // Something happened in setting up the request that triggered an Error
        console.log("[NodeJS - /upsertUserData api]Something went wrong - message : " + error
          .message);
        response.status(500)
          .send(error.message)
      }
    });

});

// endpoint to receive request for a new signup to the application 
// It will
//    1. create an entry into the registration table
//    2. Send registration confirmation on email address
// request body () :
// username : 
// email: 
// Optional : 
//    lastname: request.body.lastname || "",
//    firstname: request.body.firstname || "",
//    address: request.body.address || "",
//    phone: request.body.phone || ""
app.post("/api/processSignupRequest", function(request, response, next) {
  if (!request.body.hasOwnProperty('email')) {
    return response.status(400)
      .send({
        error: {
          type: 'missing request parameters',
          title: 'No email'
        }
      });
  }

  if (!request.body.hasOwnProperty('username')) {
    return response.status(400)
      .send({
        error: {
          type: 'missing request parameters',
          title: 'No username'
        }
      });
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
      url: 'https://' + process.env.dbHost + '/app-users/_find',
      method: 'post',
      auth: {
        username: process.env.dbHostServiceUsername,
        password: process.env.dbHostServicePassword
      },
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JSON.stringify(selector))
      },
      data: selector
    })
    .then(res => {
      if (res.data.docs.length != 0) {
        // username already exist
        return response.status(400)
          .send({
            error: {
              type: 'data duplication',
              title: "username " + request.body.username + " already exists"
            }
          });

      } else {
        axios({
            url: 'https://' + process.env.dbHost + '/user-mngt-app/',
            method: 'post',
            auth: {
              username: process.env.dbHostServiceUsername,
              password: process.env.dbHostServicePassword
            },
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(JSON.stringify(selector))
            },
            data: {
              username: request.body.username,
              email: request.body.email,
              type: 'registration',
              timestamp: new Date()
                .toISOString()
            }
          })
          .then(res => {
            if (res.data) {
              // if writing into user-mngt-app table succeeded => Send mail
              axios({
                  url: process.env.environment == 'dev' ? process.env.apiserver + ':' +
                    port + '/api/sendEMail' : process.env.apiserver + 'api/sendEMail',
                  method: 'POST',
                  data: {
                    to: request.body.email,
                    subject: "Confirm your registration request",
                    message: process.env.environment == 'dev' ?
                      "Click on the following URL to complete your registration : http://localhost:5001/processSignupConfirmation/" +
                      res.data.id :
                      "Click on the following URL to complete your registration : https://localhost:5001/processSignupConfirmation/" +
                      res.data.id
                  }
                })
                .then(result => {
                  response.send({
                    message: "User " + request.body.username + " registered",
                    tranlateKey: "registrationOK",
                    registrationID: res.data.id
                  });
                })
            }
          })
      }
    })
    .catch(error => {
      if (error.response) {
        // The request was made and the server responded with a status code that falls out of the range of 2xx
        console.log("[NodeJS - /processSignupRequest ]Something went wrong - status : " +
          error.response.status);
        response.status(error.response.status)
          .send(error.message)
      } else if (error.request) {
        // The request was made but no response was received`error.request` is an instance of XMLHttpRequest in the browser and an instance of
        // http.ClientRequest in node.js
        console.log("[NodeJS - processSignupRequest]Something went wrong - request : " + error
          .request);
        response.status(500)
          .send(error.request)
      } else {
        // Something happened in setting up the request that triggered an Error
        console.log("[NodeJS - processSignupRequest]Something went wrong - message : " + error
          .message);
        response.status(500)
          .send(error.message)
      }
    });
});

// endpoint to finalize the request for a new signup to the application 
// It will
//    1. generate a new password
//    2. create an entry into the user table (with user data and newly generate password - state is registrationDone)
//    3. create Wine Database corresponding to the chosen username
//    4. send mail to user with newly generated password
// request path contains the user request id :
app.post("/api/processSignupConfirmation/:id", function(request, response, next) {

  // Generate password
  var newPwd = Math.random()
    .toString(36)
    .slice(-8);

  // fetch request from user-mngmt table correponding to received id
  var reqID = request.params.id;
  axios({
      url: 'https://' + process.env.dbHost + '/user-mngt-app/' + reqID,
      method: 'get',
      auth: {
        username: process.env.dbHostServiceUsername,
        password: process.env.dbHostServicePassword
      },
      headers: {
        'Content-Type': 'application/json'
      }
    })
    .then(res => {
      if (res.data) {
        // verify that user with same username doesn't exist yet
        // Check that user deosn't already exists before creating a new one
        var selector = {
          "selector": {
            "$and": [{
                "app": "mycellar"
            },
              {
                "username": res.data.username
            }
          ]
          }
        };

        axios({
            url: 'https://' + process.env.dbHost + '/app-users/_find',
            method: 'post',
            auth: {
              username: process.env.dbHostServiceUsername,
              password: process.env.dbHostServicePassword
            },
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(JSON.stringify(selector))
            },
            data: selector
          })
          .then(result => {
            if (result.data.docs.length != 0) {
              return response.status(400)
                .send({
                  error: {
                    type: 'duplicate data',
                    title: 'username corresponding to user request already exist'
                  }
                });
            } else {
              // if not
              // create user data
              // First hash newly generated password with salt and store hashed value
              const salt = crypto.randomBytes(128)
                .toString('base64');

              var hashedPw;
              try {
                hashedPw = crypto.pbkdf2Sync(new, salt, 10000, length, digest);
              } catch (err) {
                response.status(500)
                  .json({
                    error: err
                  });
              }

              var createUserDataReq = {
                url: 'https://' + process.env.dbHost + '/app-users/',
                method: 'post',
                auth: {
                  username: process.env.dbHostServiceUsername,
                  password: process.env.dbHostServicePassword
                },
                headers: {
                  'Content-Type': 'application/json',
                  'Content-Length': Buffer.byteLength(JSON.stringify(selector))
                },
                data: {
                  username: res.data.username,
                  password: hashedPw,
                  salt: salt,
                  lastname: res.data.lastname || "",
                  firstname: res.data.firstname || "",
                  address: res.data.addres || "",
                  email: res.data.email || "",
                  phone: res.data.phone || "",
                  state: 'registrationDone',
                  app: 'mycellar'
                }
              }
              // create user table
              var createUserTableReq = {
                url: 'https://' + process.env.dbHostServiceUsername + ":" + process.env
                  .dbHostServicePassword + "@" + process.env.dbHost + '/cellar$' + res
                  .data.username,
                method: 'put',
                auth: {
                  username: process.env.dbHostServiceUsername,
                  password: process.env.dbHostServicePassword
                }
              }
              // send mail
              var sendMailReq = {
                url: process.env.environment == 'dev' ? process.env.apiserver + ':' +
                  port + '/api/sendEMail' : process.env.apiserver + '/api/sendEMail',
                method: 'POST',
                data: {
                  to: res.data.email,
                  subject: "Registration confirmed",
                  message: process.env.environment == 'dev' ?
                    "Your registration is confirmed. Please log on using the following credentials : " + res
                    .data
                    .username + "(username) - " + newPwd +
                    "(temporary password) on following web site: http://localhost:5001/ ." +
                    "You will be asked to immediately change your password." :
                    "Your registration is confirmed. Please log on using the following credentials : " + res
                    .data
                    .username + "(username) - " + newPwd +
                    "(temporary password) on following web site: https://pdestrais-mycellar.eu-gb.mybluemix.net/ ." +
                    "You will be asked to immediately change your password."
                }
              }

              // TODO delete registration request in user-Mngmt table

              axios.all([axios(createUserDataReq),
              axios(createUserTableReq),
              axios(sendMailReq)
            ])
                .then(axios.spread((firstResponse, secondResponse, thirdResponse) => {
                  console.log(JSON.stringify(firstResponse.data), JSON.stringify(
                    secondResponse.data), JSON.stringify(thirdResponse.data));
                  return response.status(200)
                    .send({
                      message: "User " + res.data.username + " registration done",
                      tranlateKey: "registrationDONE",
                      password: newPwd
                    })
                }))
                .catch(error => console.log(
                  "[NodeJS - /processSignupRequest ] combined http calls failed with error : " +
                  error));

            }
          });
      } else {
        return response.status(401)
          .send({
            error: {
              type: 'No data found',
              title: 'No registration request found'
            }
          });
      }

    })
    .catch(error => {
      if (error.response) {
        // The request was made and the server responded with a status code that falls out of the range of 2xx
        console.log("[NodeJS - /processSignupRequest ]Something went wrong - status : " +
          error.response.status);
        response.status(error.response.status)
          .send(error.message)
      } else if (error.request) {
        // The request was made but no response was received`error.request` is an instance of XMLHttpRequest in the browser and an instance of
        // http.ClientRequest in node.js
        console.log("[NodeJS - processSignupRequest]Something went wrong - request : " + error
          .request);
        response.status(500)
          .send(error.request)
      } else {
        // Something happened in setting up the request that triggered an Error
        console.log("[NodeJS - processSignupRequest]Something went wrong - message : " + error
          .message);
        response.status(500)
          .send(error.message)
      }
    });
});

// login method
// request body :
// - username
// - password 
// returns either :
// - Error
// - {message, translateKey, user}
app.post('/api/login', function(request, response, next) {

  if (!request.body.hasOwnProperty('username')) {
    return response.status(400)
      .send({
        error: {
          type: 'missing request parameters',
          title: 'No username'
        }
      });
  }

  if (!request.body.hasOwnProperty('password')) {
    return response.status(400)
      .send({
        error: {
          type: 'missing request parameters',
          title: 'No password'
        }
      });
  }

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

  axios({
      url: 'https://' + process.env.dbHost + '/app-users/_find',
      method: 'post',
      auth: {
        username: process.env.dbHostServiceUsername,
        password: process.env.dbHostServicePassword
      },
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JSON.stringify(selector))
      },
      data: selector
    })
    .then(result => {
      if (result.data.docs.length == 0) {
        return response.status(401)
          .send({
            error: {
              type: 'user not found',
              title: "username doesn't exist"
            }
          });
      } else {
        // username exist, compare password with stored hashed value
        user = result.data.docs[0];
        // verify that the password stored in the database corresponds to the given password
        var hash;
        try {
          hash = crypto.pbkdf2Sync(request.body.password, user.salt, 10000, length,
            digest);
        } catch (e) {
          return response.status(500)
            .send({
              error: e
            });
        }
        // check if password is correct by recalculating hash on password and comparing with stored value
        if (hash.toString('hex') === user.password) {
          console.log("password is correct");
          if (user.state == 'resetPasswordPending') {
            return response.status(400)
              .send({
                error: {
                  type: 'reset password pending',
                  title: "A password reset has been requested for this user.  Please complete reset process first."
                }
              });
          } else {
            const token = jwt.sign({
              'user': user.username,
              permissions: []
            }, process.env.secret, {
              expiresIn: '30d'
            });
            user.token = token;
            delete user.salt;
            if (user.state == 'resetPasswordDone' || user.state == 'registrationDone') {
              return response.status(200)
                .send({
                  message: "change password",
                  translateKey: "changePassword",
                  user: user
                });
            } else {
              return response.status(200)
                .send({
                  message: "OK",
                  translateKey: "OK",
                  user: user
                });
            }
          }
        } else {
          response.status(400)
            .send({
              error: {
                type: 'BadPassword',
                title: 'Wrong password'
              }
            });
        }

      }
    })
    .catch(error => {
      if (error.response) {
        // The request was made and the server responded with a status code that falls out of the range of 2xx
        console.log("[NodeJS - /processSignupRequest ]Something went wrong - status : " +
          error.response.status);
        response.status(error.response.status)
          .send(error.message)
      } else if (error.request) {
        // The request was made but no response was received`error.request` is an instance of XMLHttpRequest in the browser and an instance of
        // http.ClientRequest in node.js
        console.log("[NodeJS - processSignupRequest]Something went wrong - request : " + error
          .request);
        response.status(500)
          .send(error.request)
      } else {
        // Something happened in setting up the request that triggered an Error
        console.log("[NodeJS - processSignupRequest]Something went wrong - message : " + error
          .message);
        response.status(500)
          .send(error.message)
      }
    });
});

// changePassword method
// request body :
// - username
// - oldPassword
// returns either :
// - Error
// - {message, translateKey}
app.post('/api/changePassword', function(request, response, next) {

  if (!request.body.hasOwnProperty('username')) {
    return response.status(400)
      .send({
        error: {
          type: 'missing request parameters',
          title: 'No username'
        }
      });
  }

  if (!request.body.hasOwnProperty('oldPassword')) {
    return response.status(400)
      .send({
        error: {
          type: 'missing request parameters',
          title: 'No previous password'
        }
      });
  }

  if (!request.body.hasOwnProperty('newPassword')) {
    return response.status(400)
      .send({
        error: {
          type: 'missing request parameters',
          title: 'No new password'
        }
      });
  }

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

  axios({
      url: 'https://' + process.env.dbHost + '/app-users/_find',
      method: 'post',
      auth: {
        username: process.env.dbHostServiceUsername,
        password: process.env.dbHostServicePassword
      },
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JSON.stringify(selector))
      },
      data: selector
    })
    .then(result => {
      if (result.data.docs.length == 0) {
        return response.status(401)
          .send({
            error: {
              type: 'user not found',
              title: "username doesn't exist"
            }
          });
      } else {
        // username exist, compare password with stored hashed value
        user = result.data.docs[0];
        // verify that the password stored in the database corresponds to the given password
        var hash;
        try {
          hash = crypto.pbkdf2Sync(request.body.oldPassword, user.salt, 10000, length,
            digest);
        } catch (e) {
          return response.status(500)
            .send({
              error: e
            });
        }
        // check if password is correct by recalculating hash on password and comparing with stored value
        if (hash.toString('hex') === user.password) {
          console.log("old password is correct");
          if (user.state == 'resetPasswordPending') {
            return response.status(400)
              .send({
                error: {
                  type: 'reset password pending',
                  title: "A password reset has been requested for this user.  Please complete reset process first."
                }
              });
          } else {
            // Update user 's data state to "standard" and change password

            // TODO recalculate new hashed password based on user's salt value....

            axios({
                url: 'https://' + process.env.dbHost + '/app-users/',
                method: 'post',
                auth: {
                  username: process.env.dbHostServiceUsername,
                  password: process.env.dbHostServicePassword
                },
                headers: {
                  'Content-Type': 'application/json',
                  'Content-Length': Buffer.byteLength(JSON.stringify(selector))
                },
                data: {
                  username: user.username,
                  password: request.body.newPassword,
                  salt: user.salt,
                  lastname: user.lastname || "",
                  firstname: user.firstname || "",
                  address: user.addres || "",
                  email: user.email || "",
                  phone: user.phone || "",
                  state: 'standard',
                  app: 'mycellar'
                }
              })
              .then(result => {})
              .catch(error => {
                if (error.response) {
                  // The request was made and the server responded with a status code that falls out of the range of 2xx
                  console.log("[NodeJS - /processSignupRequest ]Something went wrong - status : " +
                    error.response.status);
                  response.status(error.response.status)
                    .send(error.message)
                } else if (error.request) {
                  // The request was made but no response was received`error.request` is an instance of XMLHttpRequest in the browser and an instance of
                  // http.ClientRequest in node.js
                  console.log("[NodeJS - processSignupRequest]Something went wrong - request : " + error
                    .request);
                  response.status(500)
                    .send(error.request)
                } else {
                  // Something happened in setting up the request that triggered an Error
                  console.log("[NodeJS - processSignupRequest]Something went wrong - message : " + error
                    .message);
                  response.status(500)
                    .send(error.message)
                }
              });
          }
        } else {
          response.status(400)
            .send({
              error: {
                type: 'BadPassword',
                title: 'Wrong password'
              }
            });
        }

      }
    })
    .catch(error => {
      if (error.response) {
        // The request was made and the server responded with a status code that falls out of the range of 2xx
        console.log("[NodeJS - /processSignupRequest ]Something went wrong - status : " +
          error.response.status);
        response.status(error.response.status)
          .send(error.message)
      } else if (error.request) {
        // The request was made but no response was received`error.request` is an instance of XMLHttpRequest in the browser and an instance of
        // http.ClientRequest in node.js
        console.log("[NodeJS - processSignupRequest]Something went wrong - request : " + error
          .request);
        response.status(500)
          .send(error.request)
      } else {
        // Something happened in setting up the request that triggered an Error
        console.log("[NodeJS - processSignupRequest]Something went wrong - message : " + error
          .message);
        response.status(500)
          .send(error.message)
      }
    });
});

// endpoint to 
//    1. Create the user into the app - users db and 
//    2. create a new database 'cellar${username}' into cloudant
// request body () :
// username :
// password: 
// email: 
// Optional : 
//    lastname: request.body.lastname || "",
//    firstname: request.body.firstname || "",
//    address: request.body.address || "",
//    phone: request.body.phone || ""
app.post("/api/register", function(request, response, next) {
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
      url: 'https://' + process.env.dbHost + '/app-users/_find',
      method: 'post',
      auth: {
        username: process.env.dbHostServiceUsername,
        password: process.env.dbHostServicePassword
      },
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JSON.stringify(selector))
      },
      data: selector
    })
    .then(res => {
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
              var url = 'https://' + process.env.dbHostServiceUsername + ":" + process.env
                .dbHostServicePassword + "@" + process.env.dbHost + '/cellar$' + request
                .body.username;
              axios(url, {
                  url: url,
                  method: 'put',
                  auth: {
                    username: process.env.dbHostServiceUsername,
                    password: process.env.dbHostServicePassword
                  }

                })
                .then(res => {
                  response.send({
                    message: "User " + request.body.username + " registered",
                    tranlateKey: "registrationOK"
                  });
                })
                .catch(error => {
                  if (error.response) {
                    // The request was made and the server responded with a status code
                    // that falls out of the range of 2xx
                    //console.log("[NodeJS - /register /create cloudant db]Something went wrong - data : " + error.response.data);
                    console.log(
                      "[NodeJS - /register /create cloudant db]Something went wrong - status : " +
                      error.response.status);
                    //console.log("[NodeJS - /register /create cloudant db]Something went wrong - status : " + error.response.headers);
                    response.status(error.response.status)
                      .send(error.message)
                  } else if (error.request) {
                    // The request was made but no response was received
                    // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
                    // http.ClientRequest in node.js
                    console.log(
                      "[NodeJS - /register /create cloudant db]Something went wrong - request : " +
                      error.request);
                    response.status(500)
                      .send(error.request)
                  } else {
                    // Something happened in setting up the request that triggered an Error
                    console.log(
                      "[NodeJS - /register /create cloudant db]Something went wrong - message : " +
                      error.message);
                    response.status(500)
                      .send(error.message)
                  }
                });
            }
          })
          .catch(err => {
            if (err.response) {
              // The request was made and the server responded with a status code
              // that falls out of the range of 2xx
              console.log("[NodeJS - /register]Something went wrong - status : " + err
                .response.status);
              response.status(err.response.status)
                .send(err.message);
            } else if (err.request) {
              // The request was made but no response was received
              // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
              // http.ClientRequest in node.js
              console.log(
                "[NodeJS - /register]Something went wrong - no response from server : " +
                err.request);
              response.status(500)
                .send(err.message);
            } else {
              // Something happened in setting up the request that triggered an Error
              console.log("[NodeJS - /register]Something went wrong in the NodeJs proxy: " +
                err.message);
              response.status(500)
                .send(err.message);
            }
          });

      }
    })
    .catch(error => {
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        //console.log("[NodeJS - /register /create cloudant db]Something went wrong - data : " + error.response.data);
        console.log(
          "[NodeJS - /register /create cloudant db]Something went wrong - status : " + error
          .response.status);
        //console.log("[NodeJS - /register /create cloudant db]Something went wrong - status : " + error.response.headers);
        response.status(error.response.status)
          .send(error.message)
      } else if (error.request) {
        // The request was made but no response was received
        // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
        // http.ClientRequest in node.js
        console.log(
          "[NodeJS - /register /create cloudant db]Something went wrong - request : " +
          error.request);
        response.status(500)
          .send(error.request)
      } else {
        // Something happened in setting up the request that triggered an Error
        console.log(
          "[NodeJS - /register /create cloudant db]Something went wrong - message : " +
          error.message);
        response.status(500)
          .send(error.message)
      }
    });
});

// endpoint to send a mail to philippe.destrais@gmail.com with user data for creation of new user by an application administrator. 
// request body () :
// - username :
// - password: 
// - email: 
app.post("/api/registerViaMail", function(request, response, next) {
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
    user: process.env.userId,
    // user: credentials.user,                  // Your GMail account used to send emails
    pass: process.env.gmailUserPwd,
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
    text: 'username: ' + request.body.username + '\npassword: ' + request.body.password +
      '\nemail: ' + request.body.email + '\n: ' + request.body.email + '\nfirst name: ' +
      request.body.firstName + '\nlast name: ' + request.body.lastName
  }, function(err, res) {
    if (err != null) {
      console.log('gmail send message call error returned')
      response.status(500)
        .send(err)
    } else {
      console.log("gmail send message call returned without error");
      response.send({
        result: 'OK'
      })
    }
    console.log('send() callback returned: err:', err, '; res:', res);
  });
});

/* Endpoint to create user in users table and encrypt given password with generated salt. Salt and password are stored. 
    Request body :
    - username (mandatory)
    - password (mandatory)
    - optional :
      - email
      - firstname
      - lastname
      - phone 
      - address
*/
app.post("/api/createUserInAppUsersTable", function(request, response, next) {
  if (!request.body.data.hasOwnProperty('password')) {
    let err = new Error('No password');
    return next(err);
  }

  if (!request.body.data.hasOwnProperty('username')) {
    let err = new Error('No user name');
    return next(err);
  }

  const salt = crypto.randomBytes(128)
    .toString('base64');

  var hashedPw;
  try {
    hashedPw = crypto.pbkdf2Sync(request.body.data.password, salt, 10000, length, digest);
  } catch (err) {
    response.status(500)
      .json({
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
    host: process.env.dbHost,
    path: '/app-users',
    method: 'POST',
    rejectUnauthorized: false,
    auth: process.env.dbHostServiceUsername + ":" + process.env.dbHostServicePassword,
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
    res.on('end', function() {
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

/* Endpoint to update user data (including password) in the user table.
    Request body :
    - username (mandatory)
    - (mandatory) either 
      - password 
      or any of :
      - email
      - firstname
      - lastname
      - phone
      - address
 */
app.post("/api/changeUserDataInUsersTable", function(request, response, next) {

  if (!request.body.data.hasOwnProperty('username')) {
    let err = new Error('No user name');
    return next(err);
  }

  if (!request.body.data.hasOwnProperty('password') &&
    !(request.body.data.hasOwnProperty('email') ||
      request.body.data.hasOwnProperty('firstname') ||
      request.body.data.hasOwnProperty('lastname') ||
      request.body.data.hasOwnProperty('phone') ||
      request.body.data.hasOwnProperty('address'))
  ) {
    let err = new Error('No password or no other user data to update');
    return next(err);
  }

  // fetch user from users table for update
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
      url: 'https://' + process.env.dbHost + '/app-users/_find',
      method: 'post',
      auth: {
        username: process.env.dbHostServiceUsername,
        password: process.env.dbHostServicePassword
      },
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JSON.stringify(selector))
      },
      data: selector
    })
    .then(res => {
      if (res.data.docs.length != 0) {
        // username exists => we can update it...
        if (request.body.data.hasOwnProperty('password')) {
          const salt = crypto.randomBytes(128)
            .toString('base64');
          var hashedPw;
          try {
            hashedPw = crypto.pbkdf2Sync(request.body.data.password, salt, 10000, length,
              digest);
          } catch (err) {
            response.status(500)
              .json({
                error: err
              });
          }
          //store user credentials (user,password,salt and other required info) into the database
          var reqData = {
            app: "mycellar",
            username: request.body.data.username,
            password: hashedPw.toString('hex'),
            salt: salt,
            _id: res.data.docs[0]._id,
            lastname: res.data.docs[0].lastname,
            firstname: res.data.docs[0].firstname,
            address: res.data.docs[0].addres,
            email: res.data.docs[0].email,
            phone: res.data.docs[0].phone,
            admin: false
          };
        } else {
          var reqData = {
            app: "mycellar",
            username: request.body.data.username,
            password: res.data.docs[0].password,
            salt: res.data.docs[0].salt,
            lastname: request.body.data.lastname || "",
            firstname: request.body.data.firstname || "",
            address: request.body.data.addres || "",
            email: request.body.data.email || "",
            phone: request.body.data.phone || "",
            admin: false
          };
        }

        var options = {
          host: process.env.dbHost,
          path: '/app-users',
          method: 'POST',
          rejectUnauthorized: false,
          auth: process.env.dbHostServiceUsername + ":" + process.env.dbHostServicePassword,
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
          res.on('end', function() {
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

      } else {
        response.send("username : " + request.body.username + " doesn't exist");
      }
    })
    .catch(error => {
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        //console.log("[NodeJS - /register /create cloudant db]Something went wrong - data : " + error.response.data);
        console.log(
          "[NodeJS - /changeUserPasswordInUsersTable api]Something went wrong - status : " +
          error.response.status);
        //console.log("[NodeJS - /register /create cloudant db]Something went wrong - status : " + error.response.headers);
        response.status(error.response.status)
          .send(error.message)
      } else if (error.request) {
        // The request was made but no response was received
        // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
        // http.ClientRequest in node.js
        console.log(
          "[NodeJS - /changeUserPasswordInUsersTable api]Something went wrong - request : " +
          error.request);
        response.status(500)
          .send(error.request)
      } else {
        // Something happened in setting up the request that triggered an Error
        console.log(
          "[NodeJS - /changeUserPasswordInUsersTable api]Something went wrong - message : " +
          error.message);
        response.status(500)
          .send(error.message)
      }
    });

});

// login method
// request body :
// username :
// password : 
app.post('/api/loginold', function(request, response, next) {

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
    host: process.env.dbHost,
    path: '/app-users/_find',
    method: 'POST',
    rejectUnauthorized: false,
    auth: process.env.dbHostServiceUsername + ":" + process.env.dbHostServicePassword,
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
    res.on('end', function() {
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
            hash = crypto.pbkdf2Sync(request.body.password, user.salt, 10000, length,
              digest);
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
            }, process.env.secret, {
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

app.get('*', function(request, response) {
  response.sendFile('index.html', {
    root: './client/www'
  });
});

var port = process.env.PORT || 5001
app.listen(port, function() {
  console.log("To view your app, open this link in your browser: http://localhost:" + port);
});
