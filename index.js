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

app.post("/papi/commands/delete/:name", function(req, res){
    var com = req.params.name;
    console.log(com);
    db.run("DELETE FROM commands WHERE chanID = ? AND name = ?", [channelID, com], function(err){
        res.redirect("/commands");
        if (config.web.sendChange == true) {
            Rebelbot.sendMsg("Command " + com + " deleted from webUI");
        }
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

app.get("/quotes", function(req, res, next){
    db.all("SELECT * from quotes where chan = ?", [channelID], function (err, row){
        console.log(row);
        res.render("quotes", {quotes: row});
    });
});

app.get("/commands", function(req, res, next){
    db.all("SELECT * FROM commands WHERE chanID = ?", [channelID], function(err, row){
        res.render("commands", {commands: row});
    });
});

app.get("/", function(req, res, next) {
    res.render("home", {isUp: Rebelbot.isUp()});
});

app.listen(port, ip, function() {
    console.log("Web server up at: " + ip + ":" + port);
});
