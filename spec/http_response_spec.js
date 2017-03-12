var request = require("request");
var meliProxy = require("../meli-proxy.js");
var conf = require("../conf/meli-proxy-conf.js");
//var base_url = conf.PROXY_API_BASE + ':' + conf.PROXY_API_PORT+'/categories/MLA97994';

var test_url = 'http://127.0.0.1:9000/categories/MLA97994';

var not_found_response = '';


describe("HTTP Response Test", function() {
  describe("GET /", function() {
    it("returns status code 200", function(done) {
      request.get(test_url, function(error, response, body) {
        expect(response.statusCode).toBe(200);
        done();
      });
    });

    it("Returns JSON Response", function(done) {
      request.get(test_url, function(error, response, body) {
        expect(body).toMatch('MLA97994');
        meliProxy.closeServers();
        done();
      });
    });
  });
});
