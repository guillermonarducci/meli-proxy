var http = require('http');
var httpProxy = require('http-proxy');
var HashMap = require('hashmap'); 
var redis = require('redis');
var conf = require('./conf/meli-proxy-conf.js');
var msg = require('./conf/meli-proxy-messages.js');
var Request = require('./model/request.js');
var RequestStat = require('./model/requestStat.js');
var ElementInfo = require('./model/elementInfo.js');
var winston = require('winston');
winston.level = conf.LOG_LEVEL; //TODO use process.env.LOG_LEVEL 

var apiEndpoint=conf.MELI_API_BASE;
var proxyPort=parseInt(process.argv[2], 10);
var mockEnabled=(process.argv[3]==conf.MOCK_PARAMETER);

var localRequestsCount = new HashMap(); //Module variable shared by all instances of this js
var totalRequestsCache = new HashMap(); //Module variable shared by all instances of this js
var statsMap = new HashMap(); //Module variable shared by all instances of this js

var exports = module.exports = {};//For testing

if ( !proxyPort || typeof proxyPort != "number" ){
    winston.info(msg.PROXY_DEFAULT_PORT + conf.PROXY_DEFAULT_PORT);
    proxyPort=conf.PROXY_DEFAULT_PORT;
}

if (mockEnabled){
    apiEndpoint=conf.MOCK_API_BASE + ':' + conf.MOCK_API_PORT;
    winston.info(msg.MOCK_MODE_ON + apiEndpoint);
    winston.warn(msg.MOCK_SERVER_REQUIRED);    
}

function processRequest(req, res) {

        var request = new Request(req);
        handleStats(request);

        var auditedElementsArray = [request.getIp()]; //Request elements to be controlled, use [request.getIp(),request.getPath(),request.getIp()+request.getPath()] to controll all.
           
        if (quotaExceed(auditedElementsArray) && !cacheExpired(auditedElementsArray)) {

            winston.info(msg.HTTP_429_MESSAGE + "--> " + request.getUrl());
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

            var quota = conf.DEFAULT_QUOTA; 

            if (elementFromCache.quota) {
                
                quota = parseInt(elementFromCache.quota,10);
            }

            winston.debug('REMAINING QUOTA FOR '+ element +'  --->  ' + ( quota - elementFromCache.requestsCount));
            exceed = exceed || (elementFromCache.requestsCount >= quota);
        } 
    });

    return exceed;
}

function cacheExpired (auditedElementsArray) { //when all elements expire, the cache is expired (check)

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
            setElementInfo(localRequestsCount, element, elementInfo);                        
            winston.debug('Added Locally one request for ' + element + '--> TOTAL: 1' );          

        } else { //If the element exists, its incremented by one

            var elementInfo = getElementInfo(localRequestsCount,element);                                                               
            elementInfo.requestsCount++;                                                                                          
            setElementInfo(localRequestsCount, element, elementInfo);  
            winston.debug('Added Locally one request for ' + element + '--> TOTAL: ' + elementInfo.requestsCount);

            if (elementInfo.requestsCount>=conf.MAX_LOCAL_REQUEST_COUNT) { //If local count for this element exceeds local count threshold, count is sent to Redis async. 

                addOnRedis (element, elementInfo.requestsCount);

                elementInfo.requestsCount=0; 
                setElementInfo(localRequestsCount, element, elementInfo); //resets local counter 
            }
            
        }        
    });
   
};

function addOnRedis (element, requestsCount) {

    var redisCli = redis.createClient(conf.REDIS_PORT, conf.REDIS_HOST, {no_ready_check: true});
  
    redisCli.on('connect', function() {

        winston.debug('Adding on Redis ' + requestsCount + ' requests to key ' + element );

        this.eval(conf.LUA_SCRIPT_SUM, 3, element, requestsCount, conf.REDIS_QUOTA_PREFIX, function (err, res){

            if (err) {

                winston.error("Error procesing Redis Script: " + err);
            };

            try {

                var totalCount=res.split(":")[0];
                var ttl = res.split(":")[1];
                var quota = res.split(":")[2];

                var currentDate = new Date();
                var expireDate = currentDate.getTime() + (1000 * ttl);
                
                var updatedElement = new ElementInfo(totalCount,expireDate, quota);
                setElementInfo(totalRequestsCache, element, updatedElement); //updates Elements in Cache

            } catch (error) {

                winston.error("Unexpected error: " + error + ". Stack: " + error.stack);
            }     
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

var proxy = httpProxy.createProxyServer({secure: false});

var server = http.createServer(processRequest).listen(proxyPort, function() {

    winston.info(msg.PROXY_LISTENING + proxyPort);

    if (!mockEnabled) {

        winston.info(msg.MOCK_MODE_AVAILABLE);    
    }
    
});

function handleStats (request) {

    var stat = statsMap.get(request.getUrl());

    if (stat) {

        stat.increment();

        if (stat.getRequestCount()>=conf.MAX_LOCAL_STATS_COUNT){

            winston.debug("STATS: " + JSON.stringify(stat));
            stat.setRequestCount(0);
        } 

        statsMap.set(stat);
 
    } else {

        var requestStat = new RequestStat(request, 1);
        statsMap.set(request.getUrl(), requestStat);
    }

};


exports.closeServers = function(){
  server.close();
  proxy.close();
};