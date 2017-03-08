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

var requestSources = new HashMap(); //Module variable shared by all instances of this js


if (mockEnabled){

    apiEndpoint=conf.MOCK_API_ENDPOINT+':'+conf.MOCK_API_PORT;

    winston.info(msg.MOCK_MODE_ON+ apiEndpoint);

    http.createServer(function(req, res) {
        res.end(conf.MOCK_API_RESPONSE);
    }).listen(conf.MOCK_API_PORT);
}


function processRequest(req, res) {

    var quota=0;
    var hostname = req.headers.host.split(":")[0];
    var pathname = url.parse(req.url).pathname;
    var ip = req.connection.remoteAddress;

    if (hasRequests(requestSources, ip)) {

        var sourceInfo = getSourceInfo(requestSources,ip);

        //TODO Validar si tiene expireDate mayor a la fecha actual, en ese caso rechazar sin ir a Redis 

        sourceInfo.requestsCount++;

        winston.debug('Adding Locally one request for' + ip + '--> TOTAL: ' + sourceInfo.requestsCount);

        setSourceInfo(requestSources, ip, sourceInfo);
        

        if (sourceInfo.requestsCount>=conf.MAX_LOCAL_REQUEST_COUNT) {

            addOnRedis (ip, sourceInfo.requestsCount, evaluateQuota);

        } else {

            proxy.web(req, res, { target: apiEndpoint });

        }

    } else {

        winston.debug('Adding Locally one request for' + ip + '--> TOTAL: 1' );

        //addOnRedis (ip, sourceInfo.requestsCount, evaluateQuota);
        //If every new IP is sent to Redis, on proxy startup almost every request goes to addOnRedis() generating heavy load to it.
        var sourceInfo = new SourceInfo(1,null); //Tradeoff: Accepting a few requests even when the quota has exceed
        setSourceInfo(requestSources, ip, sourceInfo);

        proxy.web(req, res, { target: apiEndpoint });
    } 


    function evaluateQuota (ip, quota, ttl){ 

        //Analizar race conditions en el uso del hashmap

        var sourceInfo = getSourceInfo(requestSources, ip);     

        sourceInfo.expireDate = new Date() + (1000 * ttl); //Updated expireDate 
        sourceInfo.requestsCount = 0;

        setSourceInfo(requestSources, ip, sourceInfo);//Resets local counter and updates expire date  

        if (quota < 0) {

            winston.info("Rejected with HTTP 429 (Too Many Requests)");
            res.writeHead(429);
            res.end();

        } else {

            proxy.web(req, res, { target: apiEndpoint });    
        }
    };
    
};


function addOnRedis (ip, count, callback) {

    var redisCli = redis.createClient(conf.REDIS_PORT, conf.REDIS_HOST, {no_ready_check: true});

    redisCli.on('connect', function() {
        winston.debug('Adding on Redis ' + count + ' requests to key ' + ip );
    });

    redisCli.eval(conf.LUA_SCRIPT_SUM, 2, ip, count, function (err, res) {
        
        var quota=res.split(":")[0];
        var ttl = res.split(":")[1];        

        winston.debug('REMAINING QUOTA: ' + quota + ' TIME TO LIVE: ' + ttl);

        if (err) {
            winston.error('ERROR: ' + err);
        } 

        callback(ip, quota, ttl);
            
    });

}

function getSourceInfo(requestSources, ip){

    return JSON.parse(requestSources.get(ip))

};


function setSourceInfo(requestSources, ip, sourceInfo){

    requestSources.set(ip, JSON.stringify(sourceInfo));

};

function hasRequests (requestSources, ip) {

    return requestSources.has(ip);

};

function SourceInfo(requestsCount, limitExpireDate) {
    this.requestsCount = requestsCount;
    this.limitExpireDate = limitExpireDate;
};

var proxy = httpProxy.createProxyServer({secure: false});


http.createServer(processRequest).listen(conf.PROXY_PORT, function() {

    console.log(msg.PROXY_LISTENING + conf.PROXY_PORT);
});

