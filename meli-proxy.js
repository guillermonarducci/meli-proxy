var http = require('http');
var httpProxy = require('http-proxy');
var url = require('url');
var HashMap = require('hashmap'); 
var redis = require('redis');
var conf = require('./meli-proxy-conf.js');
var msg = require('./meli-proxy-messages.js');
var winston = require('winston');
winston.level = conf.LOG_LEVEL; //TODO use process.env.LOG_LEVEL 

var apiEndpoint=conf.MELI_API_ENDPOINT;
var mockEnabled=(process.argv[2]==conf.MOCK_PARAMETER);

var sourcesCache = new HashMap();       //Module variable shared by all instances of this js
var localRequestsCount = new HashMap(); //Module variable shared by all instances of this js

if (mockEnabled){

    apiEndpoint=conf.MOCK_API_ENDPOINT + ':' + conf.MOCK_API_PORT;

    winston.info(msg.MOCK_MODE_ON + apiEndpoint);

    http.createServer(function(req, res) {
        res.end(conf.MOCK_API_RESPONSE);
    }).listen(conf.MOCK_API_PORT);
}

function processRequest(req, res) {

    var hostname = req.headers.host.split(":")[0];
    var pathname = url.parse(req.url).pathname;
    var ip = req.connection.remoteAddress;  //TODO procesar tambien Path y combinacion de ip+Path 

    if (hasSource(localRequestsCount, ip)) { //Source exists in hashmap counters

        evaluateSource(ip);

    } else { //First Request from this Source

        registerLocalRequestSource (ip);
        proxyForward(req, res);   

    }

    function evaluateSource (ip){

        
        if (quotaExceed(ip) && !cacheExpired(ip)) {

            winston.info(msg.HTTP_429_MESSAGE);
            res.writeHead(429);
            res.end();

        }  else {

            incrementRequestCount(ip);

            proxyForward(req, res);    

        }
    };    

    function proxyForward (req, res) {

        proxy.web(req, res, { target: apiEndpoint });

    };   
};

function quotaExceed (ip) {

    var exceed = false;

    if (hasSource(sourcesCache, ip)) {

        var sourceFromCache = getSourceInfo(sourcesCache, ip);

        winston.debug('REMAINING QUOTA: ' + (conf.DEFAULT_THRESHOLD - sourceFromCache.requestsCount));

        exceed=(conf.DEFAULT_THRESHOLD - sourceFromCache.requestsCount<=0);
    } 

    return exceed;
}

function cacheExpired (ip) {

    var expired = true;

    if (hasSource(sourcesCache, ip)) {

        var sourceFromCache = getSourceInfo(sourcesCache, ip); //Levanta la fecha del hashmap sin el GMT

        var currentDate = new Date();

        expired=(new Date(sourceFromCache.expireDate) <= currentDate); 

        winston.debug('CACHE_EXPIRED: ' + expired);       

    }

    return expired;

}

function incrementRequestCount (ip) { //TODO Race conditions cuando actualiza contadores en el hashmap. Ver https://www.npmjs.com/package/shulz ?
 
    var sourceInfo = getSourceInfo(localRequestsCount,ip);

    sourceInfo.requestsCount++;

    setSourceInfo(localRequestsCount, ip, sourceInfo);

    winston.debug('Added Locally one request for' + ip + '--> TOTAL: ' + sourceInfo.requestsCount);

    if (sourceInfo.requestsCount>=conf.MAX_LOCAL_REQUEST_COUNT) { //If locally counting threshold is exceed, adds on Redis

        addOnRedis (ip, sourceInfo.requestsCount, function(ip, requestCount, expireDate){ 

            var updatedSource = new SourceInfo(requestCount,expireDate);
            setSourceInfo(sourcesCache, ip, updatedSource); //updates Sources in Cache

            sourceInfo.requestsCount=0; 
            setSourceInfo(localRequestsCount, ip, sourceInfo); //resets local counter
        });
    }

};

function addOnRedis (ip, count, callback) {

    var redisCli = redis.createClient(conf.REDIS_PORT, conf.REDIS_HOST, {no_ready_check: true});

    redisCli.on('connect', function() {

        winston.debug('Adding on Redis ' + count + ' requests to key ' + ip );

        this.eval(conf.LUA_SCRIPT_SUM, 2, ip, count, function (err, res){

            if (err) throw err;

            var requestsCount=res.split(":")[0];
            var ttl = res.split(":")[1];

            var currentDate = new Date();
            var expireDate = currentDate.getTime() + (1000 * ttl); //new Date (currentDate.getTime() + (1000 * ttl));
            
            callback(ip, requestsCount, expireDate);

        }); 

    });
 
}

function getSourceInfo(hashmap, ip){

    return JSON.parse(hashmap.get(ip))

};

function setSourceInfo(hashmap, ip, sourceInfo){

    hashmap.set(ip, JSON.stringify(sourceInfo));

};

function hasSource (hashmap, ip) {

    return hashmap.has(ip);

};

function registerLocalRequestSource (ip) {

    var sourceInfo = new SourceInfo(1,null);
    setSourceInfo(localRequestsCount, ip, sourceInfo);

    winston.debug('Added Locally one request for' + ip + '--> TOTAL: 1' );

};

function SourceInfo(requestsCount, expireDate) {

    this.requestsCount = requestsCount;
    this.expireDate = expireDate;
};

var proxy = httpProxy.createProxyServer({secure: false});

http.createServer(processRequest).listen(conf.PROXY_PORT, function() {

    console.log(msg.PROXY_LISTENING + conf.PROXY_PORT);
});