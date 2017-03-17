var url = require('url');

function Request(req) {

  this.req = req;

}

Request.prototype.getIp = function() {
	return '{'+this.req.connection.remoteAddress.replace(/::ffff:/g,'')+'}';

};

Request.prototype.getPath = function() {

	return '{'+url.parse(this.req.url).pathname+'}';
};

Request.prototype.getHost = function() {
	
	return '{'+this.req.headers.host+'}';
};


Request.prototype.getUrl = function() {

	return '{'+this.req.connection.remoteAddress.replace(/::ffff:/g,'')+url.parse(this.req.url).pathname+'}';
};



module.exports = Request;
