var http = require('http');
var httpProxy = require('http-proxy');
var url = require('url');
var HashMap = require('hashmap'); 
var redis = require('redis');
var conf = require('./meli-proxy-conf.js');
var msg = require('./meli-proxy-messages.js');
var winston = require('winston');
winston.level = conf.LOG_LEVEL; //TODO Usar process.env.LOG_LEVEL 

var apiEndpoint=conf.MELI_API_ENDPOINT;
var mockEnabled=(process.argv[2]==conf.MOCK_PARAMETER);

var requestSources = new HashMap(); //Variable de module compartida por todas las instancias de este js


if (mockEnabled){

    apiEndpoint=conf.MOCK_API_ENDPOINT+':'+conf.MOCK_API_PORT;

    winston.info(msg.MOCK_MODE_ON+ apiEndpoint);

    http.createServer(function(req, res) {
        res.end(conf.MOCK_API_RESPONSE);
    }).listen(conf.MOCK_API_PORT);
}


function processRequest(req, res) {

    var hostname = req.headers.host.split(":")[0];
    var pathname = url.parse(req.url).pathname;
    var ip = req.connection.remoteAddress;

    if (requestSources.has(ip)) {

        var requestsCount = requestSources.get(ip);
        requestsCount++;
        requestSources.set(ip, requestsCount);

        winston.debug('Adding Locally one request for' + ip + '--> TOTAL: ' + requestsCount);

        if (requestsCount>=conf.MAX_LOCAL_REQUEST_COUNT) {

            addOnRedis (ip, requestsCount);
            requestSources.set(ip, 0);//Resets local count for this ip

        }

    } else {

        requestSources.set(ip, 1);
        winston.debug('Adding Locally one request for' + ip + '--> TOTAL: ' + requestsCount);
    } 

    proxy.web(req, res, { target: apiEndpoint });
};

function addOnRedis (key, value) {

    var redisCli = redis.createClient(conf.REDIS_PORT, conf.REDIS_HOST, {no_ready_check: true});

    redisCli.on('connect', function() {
        winston.debug('Adding on Redis ' + value + ' requests to key ' + key );
    });

    redisCli.eval(conf.LUA_SCRIPT_SUM, 2, key, value, function (err, res) {
        
        winston.debug('TOTAL REQUESTS: ' + res);

        if (err) {
            winston.error('ERROR: ' + err);
        } 
            
    });
}


var proxy = httpProxy.createProxyServer({secure: false});


http.createServer(processRequest).listen(conf.PROXY_PORT, function() {

    console.log(msg.PROXY_LISTENING + conf.PROXY_PORT);
});

