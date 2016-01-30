<<<<<<< HEAD
var promise = require('bluebird')
var BeamSocket = require('./node/beam/ws');
var request = require('request');
var _ = require("lodash");
var sqlite = require("sqlite3").verbose();
var urban = require('./node/apis/urban');
var gui = require('nw.gui');

var db = new sqlite.Database(gui.App.dataPath + '/db.sqlite3');
var config = require('./node/config');
console.log("[TESTINGSHIT]: " + gui.App.dataPath);

var auth;
var endpoints = null;
var apiURL = "https://beam.pro/api/v1";
var socket;

var urC = new urban.Client();

// Giant function that handles chat joining and messages.
function getChatJoin(channelID, userID) {
    request({
        method: "GET",
        uri: apiURL + "/chats/" + channelID,
        jar: true
    },
        function (err, res, body) {
            var chatData = JSON.parse(body);
            auth = chatData.authkey;
            if (endpoints == null) {
                endpoints = chatData.endpoints;

                socket = new BeamSocket(endpoints).boot();
                socket.call('auth', [channelID, userID, auth]).then(function () {
                    console.log("[getChatJoin]: You are now authed!");
                }).catch(function (err) {
                    console.log("[getChatJoin]: ERROR NOT AUTHED!");
                });

                socket.on('ChatMessage', function (data) {
                    var text = "";
                    var roles = data.user_roles;

                    _.forEach(data.message.message, function (component) {
                        switch (component.type) {
                            case 'text':
                                text += component.data;
                                break;
                            case 'emoticon':
                                text += component.text;
                                break;
                            case 'link':
                                text += component.text;
                                break;
                        }
                    });
                    if (text.indexOf("!") == 0) {
                        // Urban command
                        if (text.indexOf("!urban") == 0) {
                            var urText = text.replace('!urban ', '');
                            urC.getTerm({ term: urText }, function(err, def){
                                if (err) {
                                    console.log(err);
                                } else {
                                    sendMsg(def);
                                }
                            });
                        }

                        if (text.indexOf("!ping") == 0) {
                            var dateTime = new Date();
                            sendMsg("Pong sent at " + dateTime);
                        }

                        // Adds a Command to the DB
                        if (text.indexOf("!addcom") == 0 && isMod(roles)) {
                            var cText = text.replace('!addcom ', '');
                            var spltText = cText.split(' ');
                            var tiText = spltText.shift();
                            var comText = spltText.toString();
                            var allTheText = comText.replace(/,/g, ' ');

                            if (tiText.indexOf("!") == 0) {
                                addCom(channelID, tiText, allTheText);
                            } else {
                                var tiText2 = "!" + tiText;
                                addCom(channelID, tiText2, allTheText);
                            }

                            console.log("[TEST]: " + tiText);
                            console.log("[TEST]: " + allTheText);
                        }

                        if (text.indexOf("!delcom") == 0 && isMod(roles)) {
                            var dText = text.replace('!delcom ', '');
                            var dSpltText = cText.split(' ');
                            var dTiText = spltText.shift();
                            var dComText = spltText.toString();
                            var dAllTheText = comText.replace(/,/g, ' ');

                            delCom(channelID, dText);
                        }

                        // Deleted a quote from the DB
                        if (text.indexOf("!delquote") == 0 && isMod(roles)) {
                            var qdText = text.replace('!delquote ', '');
                            var qdSpltText = qdText.split(' ');
                            var qdTiText = qdSpltText.shift();
                            var qdComText = qdSpltText.toString();
                            var qdAllTheText = qdComText.replace(/,/g, ' ');

                            delQuote(channelID, qdAllTheText);
                        }

                        // Adds a quote to the DB
                        if (text.indexOf("!addquote") == 0 && isMod(roles)) {
                            var qaText = text.replace('!addquote ', '');
                            var qaSpltText = qaText.split(' ');
                            var qaTiText = qaSpltText.shift();
                            var qaComText = qaSpltText.toString();
                            var qaAllTheText = qaComText.replace(/,/g, ' ');

                            console.log(qaTiText);

                            addQuote(channelID, qaTiText);
                        }

                        // Grabs a quote from DB
                        if (text.indexOf("!quote") == 0) {
                            var qText = text.replace('!quote ', '');
                            var qSpltText = qText.split(' ');
                            var qTiText = qSpltText.shift();
                            var qComText = qSpltText.toString();
                            var qAllTheText = qComText.replace(/,/g, ' ');

                            console.log(qText);
                            db.get("SELECT res FROM quotes WHERE ID = ? AND chan = ?", [qText, channelID], function(err, row){
                                if(err){
                                    console.log(err);
                                    sendMsg("There was ann error getting that quote");
                                } else {
                                    sendMsg(row.res);
                                }
                            });
                        }

                        // Gets Command from the DB
                        if (text.indexOf("!addcom") != 0 && text.indexOf("!urban") != 0 && text.indexOf("!addquote") != 0 && text.indexOf("!quote") != 0 && text.indexOf("!delcom") != 0 && text.indexOf("!delquote") != 0 &&
                        text.indexOf("!ping") != 0) {
                            db.get("SELECT response FROM commands WHERE chanID = ? AND name = ?", [channelID, text], function (err, row) {
                                if (err || row == undefined) {
                                    console.log(err)
                                    sendMsg("There was an error getting that command or that command doesn't exist");
                                } else {
                                    sendMsg(row.response);
                                }
                            });
                        }
                    }
                    if(data.user_name != "rip.") {
                        console.log('[' + data.user_name + ']: ' + text);
                    }
                });

            }
            // console.log("[getChatJoin]: " + auth);
        });
}

function banUser(username, chatID, uID) {
    request({
        method: "PATCH",
        uri: apiURL + "/channels/" + chatID + "/users/" + uID,
        json: true,
        body: {
            add: ["Banned"]
        },
        jar: true
    },
        function (err, res, body) {
            console.log(username);
            console.log(body);
        }
        );
}

function sendMsg(msg) {
    var msgID = msgID++;
    socket.call('msg', [msg]).then(function () {
        console.log('[sendMsg]: ' + msg);
    }).catch(function (err) {
        console.log(err);
    });
}

function addQuote(chanID, txt) {
    db.serialize(function() {
        db.run("INSERT INTO 'quotes' VALUES(null, ?, ?)", [txt, chanID], function(err){
            sendMsg("Quote added with ID of " + this.lastID);
        });
=======
/*
Copyright 2015 Ripbandit, LLC.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/


var express = require("express");
var bot = require("./modbot");
var _ = require("lodash");
var sqlite = require("sqlite3").verbose();
var bodyParser = require("body-parser");
var request = require("request");
var config = require("./config");

var channelID = config.beam.chatID;
var port = config.web.port;
var ip = config.web.IP;
var Rebelbot = new bot.Rebelbot(channelID, config.beam.userID, config.beam.user, config.beam.pass);
var db = new sqlite.Database("./db.sqlite3");
var app = express();

app.set("view engine", "ejs");

app.locals._ = _;
app.locals.db = db;
app.locals.chanID = channelID;

app.use(express.static("static"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.post("/papi/quotes/delete/:id", function(req, res){
    var quote = req.params.id;
    console.log(quote);
    db.run("DELETE FROM quotes WHERE id = ? AND chan = ?", [quote, channelID], function(err){
        if (err) {
            res.status(500).send("Unexpected error occured, check console if you are the bot host/admin!");
        } else {
            res.status(200).json({
                quoteID: quote,
                deleted: true
            });
        }
    });
});
>>>>>>> rebelbot/dev-express

app.post("/papi/commands/add", function(req, res){
    var comName;
    if (req.body.name.indexOf("!") == 0) {
        comName = req.body.name;
    } else {
        comName = "!" + req.body.name;
    }
    db.run("INSERT INTO commands VALUES(?, ?, ?)", [channelID, comName, req.body.response], function(err){
        console.log("Command " + comName + " added!");
        if (config.web.sendChange == true) {
            Rebelbot.sendMsg("Command " + comName + " added from webUI!");
        }
        res.redirect("/commands");
    });
});

<<<<<<< HEAD
function delQuote(chanID, qID) {
    db.serialize(function(){
        db.run("DELETE FROM 'quotes' WHERE ID = ? AND chan = ?", [qID, chanID]);
        sendMsg("Quote " + qID + " Removed!");
=======
app.post("/papi/commands/delete/:name", function(req, res){
    var com = req.params.name;
    console.log(com);
    db.run("DELETE FROM commands WHERE chanID = ? AND name = ?", [channelID, com], function(err){
        res.redirect("/commands");
        if (config.web.sendChange == true) {
            Rebelbot.sendMsg("Command " + com + " deleted from webUI");
        }
>>>>>>> rebelbot/dev-express
    });
});

app.get("/papi/start", function(req, res, next){
    Rebelbot.login();
    res.redirect("/");
})

app.get("/papi/stop", function(req, res, next){
    Rebelbot.logout();
    res.redirect("/");
});

<<<<<<< HEAD
function delCom(chanID, com) {
    db.serialize(function(){
        db.run("DELETE FROM 'commands' WHERE chanid = ? AND name = ?", [chanID, com]);
        sendMsg("Command " + com + " removed!");
=======
app.get("/quotes", function(req, res, next){
    db.all("SELECT * from quotes where chan = ?", [channelID], function (err, row){
        console.log(row);
        res.render("quotes", {quotes: row});
>>>>>>> rebelbot/dev-express
    });
});

<<<<<<< HEAD
function addCom(chanID, com, res) {
    db.serialize(function () {
        db.run("INSERT INTO 'commands' VALUES(?, ?, ?)", [chanID, com, res]);
        sendMsg("Command " + com + " added!");
    });
}

function isMod(ranks) {
    if(ranks.indexOf("Mod") >= 0 || ranks.indexOf("Owner") >= 0) {
        return true;
    } else {
        return false;
    }
}

function loginBot(username, password) {
    request({
        method: "POST",
        uri: apiURL + "/users/login",
        form: {
            username: username,
            password: password
        },
        jar: true
    },
        function (err, res, body) {
            // console.log("[loginBot]: " + body);
            getChatJoin(config.beam.chatID, config.beam.userID);
        });
}

function logoutBot() {
    if(socket.isConnected) {
        socket.close();
        console.log("[logoutBot]: Bot is now disconnected!");
    } else {
        console.log("[logoutBot]: Bot isn't connected!");
    }
}

function restartBot(username, password) {
    if(socket.isConnected) {
        logoutBot();
        loginBot(username, password);
    }
}

process.on('uncaughtException', function(err) {
  console.log('Caught exception: ' + err);
=======
app.get("/commands", function(req, res, next){
    db.all("SELECT * FROM commands WHERE chanID = ?", [channelID], function(err, row){
        res.render("commands", {commands: row});
    });
>>>>>>> rebelbot/dev-express
});

app.get("/", function(req, res, next) {
    res.render("home", {isUp: Rebelbot.isUp()});
});

app.listen(port, ip, function() {
    console.log("Web server up at: " + ip + ":" + port);
});
