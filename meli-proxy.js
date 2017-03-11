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

var localRequestsCount = new HashMap(); //Module variable shared by all instances of this js
var totalRequestsCache = new HashMap(); //Module variable shared by all instances of this js

if (mockEnabled){
    apiEndpoint=conf.MOCK_API_ENDPOINT + ':' + conf.MOCK_API_PORT;
    winston.info(msg.MOCK_MODE_ON + apiEndpoint);
    winston.warn(msg.MOCK_SERVER_REQUIRED);    
}

function processRequest(req, res) {

    winston.debug('');

    var pathname = url.parse(req.url).pathname;
    var ip = req.connection.remoteAddress.replace(/::ffff:/g,'');;

    var auditedElementsArray = [ip]; //Request elements to be controlled, use [ip, pathname, ip+pathname] to controll all.
       
    if (quotaExceed(auditedElementsArray) && !cacheExpired(auditedElementsArray)) {

        winston.info(msg.HTTP_429_MESSAGE);
        res.writeHead(429);
        res.end();

    }  else {

        incrementRequestCount(auditedElementsArray);

        proxy.web(req, res, { target: apiEndpoint });//Proxy Forward
    }
};     

function quotaExceed (auditedElementsArray) { //If one element is exceed, the request is exceed

    var exceed = false;

    auditedElementsArray.forEach(function(element){
 

        if (hasElement(totalRequestsCache, element)) {

            var elementFromCache = getElementInfo(totalRequestsCache, element);

            winston.debug('REMAINING QUOTA FOR '+ element +'  --->  ' + (conf.DEFAULT_QUOTA - elementFromCache.requestsCount));

            exceed = exceed || (elementFromCache.requestsCount >= conf.DEFAULT_QUOTA);
        } 
    });

    return exceed;
}

function cacheExpired (auditedElementsArray) { //if one element is expired, the cache is expired

    var expired = true;

    auditedElementsArray.forEach(function(element){

        if (hasElement(totalRequestsCache, element)) {

            var elementFromCache = getElementInfo(totalRequestsCache, element);

            var currentDate = new Date();

            expired = expired && (new Date(elementFromCache.expireDate) <= currentDate);

            winston.debug('CACHE FOR '+ element +' EXPIRED: ' + expired);  
        }
    });
     
    return expired;
}

function incrementRequestCount (auditedElementsArray) { 

    auditedElementsArray.forEach(function(element){

        if (!hasElement(localRequestsCount,element)){ //If this element doesn't exist in local counters, a new local counter is created

            var elementInfo = new ElementInfo(1,null);                                    
            setElementInfo(localRequestsCount, element, elementInfo);  //TODO Race conditions en contadores del hashmap. Ver https://www.npmjs.com/package/shulz ?                        
            winston.debug('Added Locally one request for ' + element + '--> TOTAL: 1' );          

        } else { //If the element exists, its incremented by one

            var elementInfo = getElementInfo(localRequestsCount,element);                                                               
            elementInfo.requestsCount++;                                                                                                 
            setElementInfo(localRequestsCount, element, elementInfo);  
            winston.debug('Added Locally one request for ' + element + '--> TOTAL: ' + elementInfo.requestsCount);                            

            if (elementInfo.requestsCount>=conf.MAX_LOCAL_REQUEST_COUNT) { //If local count for this element exceeds local count threshold, count is sent to Redis async. 

                addOnRedis (element, elementInfo);
            }
        }        
    });
};

function addOnRedis (element, elementInfo, callback) {

    var redisCli = redis.createClient(conf.REDIS_PORT, conf.REDIS_HOST, {no_ready_check: true});

    redisCli.on('connect', function() {

        winston.debug('Adding on Redis ' + elementInfo.requestsCount + ' requests to key ' + element );

        this.eval(conf.LUA_SCRIPT_SUM, 2, element, elementInfo.requestsCount, function (err, res){

            if (err) throw err;

            var requestsCount=res.split(":")[0];
            var ttl = res.split(":")[1];

            var currentDate = new Date();
            var expireDate = currentDate.getTime() + (1000 * ttl);
            
            var updatedElement = new ElementInfo(requestsCount,expireDate);
            setElementInfo(totalRequestsCache, element, updatedElement); //updates Elements in Cache

            elementInfo.requestsCount=0; 
            setElementInfo(localRequestsCount, element, elementInfo); //resets local counter  
        }); 
    });
}

function getElementInfo(hashmap, element){

    return JSON.parse(hashmap.get(element))
};

function setElementInfo(hashmap, element, elementInfo){

    hashmap.set(element, JSON.stringify(elementInfo));
};

function hasElement (hashmap, element) {

    return hashmap.has(element);
};

function ElementInfo(requestsCount, expireDate) {

    this.requestsCount = requestsCount;
    this.expireDate = expireDate;
};

var proxy = httpProxy.createProxyServer({secure: false});

http.createServer(processRequest).listen(conf.PROXY_PORT, function() {

    winston.info(msg.PROXY_LISTENING + conf.PROXY_PORT);

    if (!mockEnabled) {

        winston.info(msg.MOCK_MODE_AVAILABLE);    
    }
    
});