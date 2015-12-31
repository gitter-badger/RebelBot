var promise = require('bluebird');
var BeamSocket = require('./node/beam/ws');
var request = require('request');
var _ = require("lodash");
var sqlite = require("sqlite3").verbose();
var urban = require('./node/apis/urban');
var gui = require('nw.gui');

var db = new sqlite.Database(gui.App.dataPath + '/db.sqlite3');
var config = require('./node/config');

var auth;
var endpoints = null;
var apiURL = "https://beam.pro/api/v1";
var socket;

var urC = new urban.Client();

// Modifying a object you don't own is bad, but I did it anyway.
String.prototype.has = function(str) {
    if (this.indexOf(str) != -1) {
        return true;
    } else {
        return false;
    }
};

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
                                if (isMod(roles)) {
                                    text += component.text;
                                } else {
                                    banUser(data.user_name);
                                }
                                break;
                        }
                    });
                    if (text.indexOf("!") == 0) {
                        // Urban command
                        if (text.indexOf("!urban") == 0 && isMod(roles)) {
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

                            log("!addcom", "[TEST]: " + tiText, false);
                            log("!addcom", "[TEST]: " + allTheText, false);
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
                                    log("!quote", err, true);
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
                                    log("getcom", err, true);
                                    sendMsg("There was an error getting that command or that command doesn't exist");
                                } else {
                                    var msgString = row.response;
                                    if (msgString.has("%username%") == true) {
                                        sendMsg(msgString.replace("%username%", data.user_name));
                                    } else {
                                        sendMsg(msgString);
                                    }
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
        });
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

    });
}

function delQuote(chanID, qID) {
    db.serialize(function(){
        db.run("DELETE FROM 'quotes' WHERE ID = ? AND chan = ?", [qID, chanID]);
        sendMsg("Quote " + qID + " Removed!");
    });
}

function delCom(chanID, com) {
    db.serialize(function(){
        db.run("DELETE FROM 'commands' WHERE chanid = ? AND name = ?", [chanID, com]);
        sendMsg("Command " + com + " removed!");
    });
}

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

function log(srcFunc, txt, isError) {
    if (srcFunc == null) {
        console.log(txt);
    } else {
        console.log("[" + srcFunc + "]: " + txt);
    }
    
    if (txt == null) {
        console.log("[" + "log" + "]: TXT PARAMETER NULL.");
    }
    
    if (txt != null && isError == true && srcFunc != null) {
        console.log("[ERROR]: " + "[" + srcFunc + "]: " + txt);
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
        log("logoutBot", "Bot is now disconnected!", false);
    } else {
        console.log("logoutBot", "Bot isn't connected!", true);
    }
}

function restartBot(username, password) {
    if(socket.isConnected) {
        logoutBot();
        loginBot(username, password);
    }
}

process.on('uncaughtException', function(err) {
  log('Caught exception: ' + err);
});


// loginBot(config.beam.user, config.beam.pass);
// console.log(data);
