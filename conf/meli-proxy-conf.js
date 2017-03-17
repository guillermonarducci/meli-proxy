const MELI_API_BASE ='https://api.mercadolibre.com';
const MOCK_API_BASE ='http://localhost';
const MOCK_API_PORT = '9001';
const MOCK_API_RESPONSE = '{"id": "MLA340374","name": "iPhone 4S","picture": null,"permalink": null,"total_items_in_this_category": 1318}';
const MOCK_PARAMETER ='mockTarget';
const PROXY_BASE ='http://localhost';
const PROXY_DEFAULT_PORT ='9000';
const REDIS_HOST1 ='localhost';
const REDIS_PORT1 ='30001';
const REDIS_HOST2 ='localhost';
const REDIS_PORT2 ='30002';
const LOG_LEVEL ='debug';
const DEFAULT_QUOTA =5000000000;
const QUOTA_TTL_IN_SECONDS ='3600';
const MAX_LOCAL_REQUEST_COUNT = 1000;
const MAX_LOCAL_STATS_COUNT = 1000;
const REDIS_QUOTA_PREFIX = '_quota:';

var scriptSum = '\  local count = tonumber(redis.call("get", KEYS[1])) \
                    local ttl = nil \
                    if count==nil then \
                        redis.call("set", KEYS[1], ARGV[1]) \
                        redis.call("expire", KEYS[1], QUOTA_TTL_VALUE) \
                        count=ARGV[1] \
                        ttl = QUOTA_TTL_VALUE \
                    else  \
                        count = count + ARGV[1] \
                        ttl = redis.call("ttl", KEYS[1]) \
                        redis.call("set", KEYS[1], count) \
                        redis.call("expire", KEYS[1], ttl) \
                    end \
                    local response=nil \
                    local quota = tonumber(redis.call("get",ARGV[2] .. KEYS[1])) \
                    if quota==nil then \
                        response = count .. ":" .. ttl \
                    else \
                        response = count .. ":" .. ttl .. ":" .. quota\
                    end \
                    return response'; 

const LUA_SCRIPT_SUM = scriptSum.replace(/QUOTA_TTL_VALUE/g,QUOTA_TTL_IN_SECONDS);    

module.exports = {
    
    MELI_API_BASE: MELI_API_BASE,
    MOCK_API_BASE: MOCK_API_BASE,
    MOCK_API_PORT: MOCK_API_PORT,
    MOCK_API_RESPONSE: MOCK_API_RESPONSE,
    MOCK_PARAMETER: MOCK_PARAMETER,
    PROXY_BASE: PROXY_BASE,
    REDIS_HOST1: REDIS_HOST1,
    REDIS_PORT1: REDIS_PORT1,
    REDIS_HOST2: REDIS_HOST2,
    REDIS_PORT2: REDIS_PORT2,
    LUA_SCRIPT_SUM: LUA_SCRIPT_SUM,
    MAX_LOCAL_REQUEST_COUNT: MAX_LOCAL_REQUEST_COUNT,
    MAX_LOCAL_STATS_COUNT: MAX_LOCAL_STATS_COUNT,
    LOG_LEVEL: LOG_LEVEL,
    DEFAULT_QUOTA: DEFAULT_QUOTA,
    REDIS_QUOTA_PREFIX: REDIS_QUOTA_PREFIX,
    PROXY_DEFAULT_PORT: PROXY_DEFAULT_PORT

};