const MELI_API_ENDPOINT ='https://api.mercadolibre.com';
const MOCK_API_ENDPOINT ='http://localhost';
const MOCK_API_PORT = '9001';
const MOCK_API_RESPONSE = '{"id": "MLA340374","name": "iPhone 4S","picture": null,"permalink": null,"total_items_in_this_category": 1318}';
const MOCK_PARAMETER ='mockTarget';
const PROXY_PORT ='9000';
const REDIS_HOST ='localhost';
const REDIS_PORT ='6379';
const LOG_LEVEL ='debug';
const DEFAULT_QUOTA =25;
const QUOTA_TTL_IN_SECONDS ='40';
const MAX_LOCAL_REQUEST_COUNT = 5;

var scriptSum = '\  local count = tonumber(redis.call("get", KEYS[1])) \
                    local ttl = nil \
                    if count==nil then \
                        redis.call("set", KEYS[1], KEYS[2]) \
                        redis.call("expire", KEYS[1], QUOTA_TTL_VALUE) \
                        count=KEYS[2] \
                        ttl = QUOTA_TTL_VALUE \
                    else  \
                        count = count + KEYS[2] \
                        ttl = redis.call("ttl", KEYS[1]) \
                        redis.call("set", KEYS[1], count) \
                        redis.call("expire", KEYS[1], ttl) \
                    end \
                    return count .. ":" .. ttl;'; 

const LUA_SCRIPT_SUM = scriptSum.replace(/QUOTA_TTL_VALUE/g,QUOTA_TTL_IN_SECONDS);    

module.exports = {
    
    MELI_API_ENDPOINT: MELI_API_ENDPOINT,
    MOCK_API_ENDPOINT: MOCK_API_ENDPOINT,
    MOCK_API_PORT: MOCK_API_PORT,
    MOCK_API_RESPONSE: MOCK_API_RESPONSE,
    MOCK_PARAMETER: MOCK_PARAMETER,
    PROXY_PORT: PROXY_PORT,
    REDIS_HOST: REDIS_HOST,
    REDIS_PORT: REDIS_PORT,
    LUA_SCRIPT_SUM: LUA_SCRIPT_SUM,
    MAX_LOCAL_REQUEST_COUNT: MAX_LOCAL_REQUEST_COUNT,
    LOG_LEVEL: LOG_LEVEL,
    DEFAULT_QUOTA   
};