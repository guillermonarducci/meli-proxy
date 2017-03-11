var http = require('http');
var url = require('url');
var msg = require('./conf/meli-proxy-messages.js');
var conf = require('./conf/meli-proxy-conf.js');

http.createServer(function(req, res) {

    console.log('NEW REQUEST: ' + url.parse(req.url).pathname);

    res.end(conf.MOCK_API_RESPONSE);

}).listen(conf.MOCK_API_PORT);

console.log('Mock Server Listening on port : ' + conf.MOCK_API_PORT);