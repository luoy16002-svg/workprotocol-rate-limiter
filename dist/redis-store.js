const FIXED_WINDOW_SCRIPT = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then redis.call("PEXPIRE", KEYS[1], ARGV[1]) end
local ttl = redis.call("PTTL", KEYS[1])
return { current, ttl }
`;
const SLIDING_WINDOW_SCRIPT = `
redis.call("ZREMRANGEBYSCORE", KEYS[1], 0, ARGV[1] - ARGV[2])
local count = redis.call("ZCARD", KEYS[1])
local allowed = 0
if count < tonumber(ARGV[3]) then
  allowed = 1
  redis.call("ZADD", KEYS[1], ARGV[1], ARGV[4])
  count = count + 1
end
redis.call("PEXPIRE", KEYS[1], ARGV[2])
local oldest = redis.call("ZRANGE", KEYS[1], 0, 0, "WITHSCORES")
return { allowed, count, oldest[2] or ARGV[1] }
`;
const TOKEN_BUCKET_SCRIPT = `
local capacity = tonumber(ARGV[1])
local now = tonumber(ARGV[2])
local refill = tonumber(ARGV[3])
local cost = tonumber(ARGV[4])
local tokens = tonumber(redis.call("HGET", KEYS[1], "tokens")) or capacity
local updated = tonumber(redis.call("HGET", KEYS[1], "updatedAt")) or now
local elapsed = math.max(0, now - updated)
tokens = math.min(capacity, tokens + elapsed * refill)
local allowed = 0
if tokens >= cost then
  allowed = 1
  tokens = tokens - cost
end
redis.call("HSET", KEYS[1], "tokens", tokens, "updatedAt", now)
redis.call("PEXPIRE", KEYS[1], math.ceil((capacity / refill) * 2))
return { allowed, tokens }
`;
function asNumberArray(value) {
    if (!Array.isArray(value)) {
        throw new Error("Redis script returned a non-array response");
    }
    return value.map((item) => Number(item));
}
export class RedisRateLimitStore {
    redis;
    constructor(redis) {
        this.redis = redis;
    }
    async consumeFixedWindow(input) {
        const [count, ttl] = asNumberArray(await this.redis.eval(FIXED_WINDOW_SCRIPT, 1, input.key, input.windowMs));
        const resetTime = input.now + Math.max(0, ttl);
        return {
            allowed: count <= input.limit,
            key: input.key,
            limit: input.limit,
            remaining: Math.max(0, input.limit - count),
            resetTime,
            retryAfterMs: count <= input.limit ? 0 : Math.max(0, ttl),
            strategy: "fixed-window"
        };
    }
    async consumeSlidingWindow(input) {
        const member = `${input.now}:${Math.random().toString(36).slice(2)}`;
        const [allowedRaw, count, oldest] = asNumberArray(await this.redis.eval(SLIDING_WINDOW_SCRIPT, 1, input.key, input.now, input.windowMs, input.limit, member));
        const resetTime = oldest + input.windowMs;
        const allowed = allowedRaw === 1;
        return {
            allowed,
            key: input.key,
            limit: input.limit,
            remaining: Math.max(0, input.limit - count),
            resetTime,
            retryAfterMs: allowed ? 0 : Math.max(0, resetTime - input.now),
            strategy: "sliding-window"
        };
    }
    async consumeTokenBucket(input) {
        const [allowedRaw, tokens] = asNumberArray(await this.redis.eval(TOKEN_BUCKET_SCRIPT, 1, input.key, input.limit, input.now, input.refillRatePerMs, input.cost));
        const allowed = allowedRaw === 1;
        const retryAfterMs = allowed ? 0 : Math.ceil((input.cost - tokens) / input.refillRatePerMs);
        return {
            allowed,
            key: input.key,
            limit: input.limit,
            remaining: Math.max(0, Math.floor(tokens)),
            resetTime: input.now + Math.ceil((input.limit - tokens) / input.refillRatePerMs),
            retryAfterMs,
            strategy: "token-bucket"
        };
    }
}
export function createRedisStore(redis) {
    return new RedisRateLimitStore(redis);
}
