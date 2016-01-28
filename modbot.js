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

var request = require("request");
var BeamSocket = require("./beam/ws");
var promise = require("bluebird");
var _ = require("lodash");
var sqlite = require("sqlite3").verbose();
var urban = require("./apis/urban");

var auth = null;
var endpoints = null;
var apiUrl = "https://beam.pro/api/v1";
var socket = null;

// Modifying a object you don't own is bad, but I did it anyway.
String.prototype.has = function(str) {
    if (this.indexOf(str) != -1) {
        return true;
    } else {
        return false;
    }
};

function Rebelbot(cID, uID, username, password) {
    this.cID = cID;
    this.uID = uID;
    this.username = username;
    this.password = password;
    this.beamsocket = null;
    this.db = new sqlite.Database("./db.sqlite3");
}

Rebelbot.prototype.login = function () {
    var self = this;
    request({
        method: "POST",
        uri: apiUrl + "/users/login",
        form: {
            username: self.username,
            password: self.password
        },
        jar: true
    },
    function (err, res, body) {
        if(!err) {
            request({
                method: "GET",
                uri: apiUrl + "/chats/" + self.cID,
                jar: true
            },
            function(err, res, body) {
                var chatData = JSON.parse(body);
                auth = chatData.authkey;

                if (endpoints == null) {
                    endpoints = chatData.endpoints;

                    socket = new BeamSocket(endpoints).boot();
                    socket.call('auth', [self.cID, self.uID, auth]).then(function() {
                        console.log("[login]: now authed!");
                    }).catch(function (err){
                        console.log("[ERROR] [login]: NOT AUTHED!!");
                    });

                    self.beamsocket = socket;

                    socket.on("ChatMessage", function (data){
                        var text = "";
                        var roles = data.user_roles;

                        _.forEach(data.message.message, function (component){
                            switch(component.type) {
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

                        if(text.indexOf("!") == 0) {
                            if(text.indexOf("!urban") == 0 && self.isMod(roles)) {
                                var urText = text.replace("!urban ", "");
                                var urC = new urban.Client();
                                urC.getTerm({ term: urText }, function (err, def) {
                                    if (err) {
                                        self.Log("!urban", err, true);
                                    } else {
                                        self.sendMsg(def);
                                    }
                                });
                            }

                            if (text.indexOf("!ping") == 0) {
                                var dateTime = new Date();
                                self.sendMsg("pong sent at: " + dateTime);
                            }

                            if (text.indexOf("!addcom") == 0 && self.isMod(roles)) {
                                var cText = text.replace('!addcom ', '');
                                var spltText = cText.split(' ');
                                var tiText = spltText.shift();
                                var comText = spltText.toString();
                                var allTheText = comText.replace(/,/g, ' ');

                                if (tiText.indexOf("!") == 0) {
                                    self.addCom(self.cID, tiText, allTheText);
                                } else {
                                    var tiText2 = "!" + tiText;
                                    self.addCom(self.cID, tiText2, allTheText);
                                }
                                self.Log("!addcom", "TEST " + tiText, false);
                                self.Log("!addcom", "TEST " + allTheText, false);
                            }

                            if (text.indexOf("!delcom") == 0 && self.isMod(roles)) {
                                var dText = text.replace('!delcom ', '');
                                var dSpltText = dText.split(' ');
                                var dTiText = dSpltText.shift();
                                var dComText = dSpltText.toString();
                                var dAllTheText = dComText.replace(/,/g, ' ');

                                self.delCom(self.cID, dText);
                            }

                            if (text.indexOf("!addquote") == 0 && self.isMod(roles)) {
                                var qaText = text.replace('!addquote ', '');
                                var qaSpltText = qaText.split(' ');
                                var qaTiText = qaSpltText.shift();
                                var qaComText = qaSpltText.toString();
                                var qaAllTheText = qaComText.replace(/,/g, ' ');

                                console.log(qaTiText);

                                self.addQuote(self.cID, qaTiText);
                            }

                            if (text.indexOf("!delquote") == 0 && self.isMod(roles)) {
                                var qdText = text.replace('!delquote ', '');
                                var qdSpltText = qdText.split(' ');
                                var qdTiText = qdSpltText.shift();
                                var qdComText = qdSpltText.toString();
                                var qdAllTheText = qdComText.replace(/,/g, ' ');

                                self.delQuote(self.cID, qdAllTheText);
                            }

                            if (text.indexOf("!quote") == 0) {
                                var qText = text.replace('!quote ', '');
                                var qSpltText = qText.split(' ');
                                var qTiText = qSpltText.shift();
                                var qComText = qSpltText.toString();
                                var qAllTheText = qComText.replace(/,/g, ' ');

                                console.log(qText);
                                self.db.get("SELECT res FROM quotes WHERE ID = ? AND chan = ?", [qText, self.cID], function(err, row){
                                    if(err){
                                        log("!quote", err, true);
                                        self.sendMsg("There was ann error getting that quote");
                                    } else {
                                        self.sendMsg(row.res);
                                    }
                                });
                            }

                            if (text.indexOf("!ban") == 0 && self.isMod(roles)) {
                                var banText = text.replace("!ban ", "");
                                self.banUser(banText);
                            }

                            if(text.indexOf("!bug") == 0 && self.isMod(roles)) {
                                self.sendMsg("You can submit bug reports at https://github.com/ripbandit/RebelBot/issues or tweet @Ripbandit_ with them!");
                            }

                            if (text.indexOf("!addcom") != 0 && text.indexOf("!urban") != 0 && text.indexOf("!addquote") != 0 && text.indexOf("!quote") != 0 && text.indexOf("!delcom") != 0 && text.indexOf("!delquote") != 0 &&
                            text.indexOf("!ping") != 0 && text.indexOf("!ban") != 0 && text.indexOf("!bug")) {
                                self.getCom(self.cID, text, function(err, res) {
                                    if (err) {
                                        self.Log("ChatMessage.getCom", "There was an error getting command " + text, true);
                                        self.sendMsg("There was an error getting command " + text + " either it doesn't exist or the bot broke.");
                                    } else {
                                        if (res.has("{USERNAME}")) {
                                            self.sendMsg(res.replace("{USERNAME}", self.data.user_name));
                                        } else {
                                            self.sendMsg(res);
                                        }
                                    }
                                });
                            }
                        }
                    });
                }
            });
        }
    });
};

Rebelbot.prototype.logout = function () {
    if (this.beamsocket != null) {
        this.beamsocket.close();
    } else {
        console.log("bot not started yet!");
    }
};

Rebelbot.prototype.Log = function (funcName, logStr, isError) {
    if (isError == true) {
        console.log("[ERROR] [" + funcName + "]: " + logStr);
    } else {
        console.log("[" + funcName + "]: " + logStr);
    }
};

Rebelbot.prototype.sendMsg = function (msg) {
    var self = this;
    if (this.beamsocket == null) {
        self.Log("sendMsg", "Bot not logged in!", true);
    } else {
        this.beamsocket.call("msg", [msg]).then(function(){
            self.Log("sendMsg", msg, false);
        });
    }
};

Rebelbot.prototype.addCom = function (chanID, com, res) {
    var self = this;
    this.db.serialize(function () {
        self.db.run("INSERT INTO 'commands' VALUES(?, ?, ?)", [chanID, com,res], function (err){
            self.sendMsg("Command " + com + " added!");
        });
    });
};

Rebelbot.prototype.delCom = function (chanID, com) {
    var self = this;
    this.db.serialize(function () {
        self.db.run("DELETE FROM 'commands' WHERE chanid = ? AND name = ?", [chanID, com], function (err) {
            self.sendMsg("Command " + com + " deleted!");
        });

    });
};

Rebelbot.prototype.getCom = function (chanID, com, cb) {
    var self = this;
    this.db.get("SELECT response FROM commands WHERE chanID = ? AND name = ?", [chanID, com], function(err, row){
        if (err || row == undefined) {
            cb(true, null);
        } else {
            var msgString = row.response;
            cb(false, msgString);
        }
    });
}

Rebelbot.prototype.addQuote = function (chanID, txt) {
    var self = this;
    this.db.serialize(function () {
        self.db.run("INSERT INTO 'quotes' VALUES(null, ?, ?)", [txt, chanID], function (err) {
            self.sendMsg("Quote added with ID of " + this.lastID);
        });
    });
};

Rebelbot.prototype.delQuote = function (chanID, qID) {
    var self = this;
    this.db.serialize(function (){
        self.db.run("DELETE FROM 'quotes' WHERE ID = ? AND chan = ?", [qID, chanID], function (err){
            self.sendMsg("Quote " + qID + " deleted!");
        });
    });
}

Rebelbot.prototype.isMod = function (ranks) {
    if (ranks.indexOf("Mod") >= 0 || ranks.indexOf("Owner") >= 0) {
        return true;
    } else {
        return false;
    }
}

Rebelbot.prototype.isUp = function() {
    if (this.beamsocket != null && this.beamsocket.status == BeamSocket.CONNECTED) {
        return true;
    } else {
        return false;
    }
}

Rebelbot.prototype.banUser = function(user) {
    var self = this;
    request({
        method: "PATCH",
        uri: apiUrl + "/channels/" + self.cID + "/users/" + user,
        json: true,
        body: {
            add: ["Banned"]
        },
        jar: true
    }, function(err, res, body){
        console.log(res);
        console.log(body);
        if (err || res.statusCode == 400 || res.statusCode == 403 || res.statusCode == 404) {
            self.Log("banUser", "Error banning user " + user, true);
        } else {
            self.Log("banUser", "banned user " + user, false);
        }
    });
}

exports.Rebelbot = Rebelbot;
