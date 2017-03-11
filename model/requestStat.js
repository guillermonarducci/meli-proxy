var Request = require('./request.js');

function RequestStat(request, requestCount) {

  this.host = request.getHost();
  this.ip = request.getIp();
  this.path = request.getPath();
  this.requestCount = requestCount;

}

RequestStat.prototype.getRequestCount = function() {

	return this.requestCount;
};

RequestStat.prototype.setRequestCount = function(requestCount) {

	this.requestCount=requestCount;
};

RequestStat.prototype.increment = function() {

	this.requestCount++;
};

module.exports = RequestStat;
