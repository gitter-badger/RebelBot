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

var request = require('request');

var urban_api = 'http://api.urbandictionary.com/v0/'

function Client(){

}

//SELF EXPLANITORY
Client.prototype.getTerm = function(term, cb){
    if(term == 'undefined' || !term) return false;
    if (!cb || typeof cb != 'function') return false;

    request.get({
        url: urban_api + "define",
        qs: term,
    }, function(err, res, body){
        if(err){
            cb(err);
        } else {
            var ex = null;
            var def = null;

            try {
                body = JSON.parse(body);
            } catch(err) {
                ex = err;
            }

            if (body.list = -1) {
                ex = "Error: No results";
                def = null;
                cb (ex, def);
            } else {
                def = body.list[0].definition;
                cb (ex, def);
            }
        }
    });
}

exports.Client = Client;
