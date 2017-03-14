/*TODO Replace with i18n*/	

const PROXY_LISTENING ='Proxy listening on port ';
const MOCK_MODE_AVAILABLE ="You can mock target server starting with command  -->  npm start PORT mockTarget";
const MOCK_MODE_ON ='Mock Mode: ON --> Mock API Endpoint: ';
const MOCK_SERVER_REQUIRED = "Don't forget to start Mock Server running command  -->  node mock-server.js";
const HTTP_429_MESSAGE ="Rejected with HTTP 429 (Too Many Requests)";
const PROXY_DEFAULT_PORT ="Proxy Port not specified. Using default port: ";

module.exports = {

  	PROXY_LISTENING: PROXY_LISTENING,
  	MOCK_MODE_AVAILABLE: MOCK_MODE_AVAILABLE,
  	MOCK_MODE_ON: MOCK_MODE_ON,
  	MOCK_SERVER_REQUIRED: MOCK_SERVER_REQUIRED,
  	HTTP_429_MESSAGE: HTTP_429_MESSAGE,
  	PROXY_DEFAULT_PORT: PROXY_DEFAULT_PORT
};