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

            try{
                body = JSON.parse(body);
            } catch(err) {
                ex = err
            }

            var def = body.list[0].definition;

            cb(ex, def);
        }
    })
}

exports.Client = Client;
