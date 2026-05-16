export class MemoryRateLimitStore {
    fixed = new Map();
    sliding = new Map();
    buckets = new Map();
    async consumeFixedWindow(input) {
        const entry = this.fixed.get(input.key);
        const active = entry && entry.resetTime > input.now ? entry : { count: 0, resetTime: input.now + input.windowMs };
        active.count += 1;
        this.fixed.set(input.key, active);
        return {
            allowed: active.count <= input.limit,
            key: input.key,
            limit: input.limit,
            remaining: Math.max(0, input.limit - active.count),
            resetTime: active.resetTime,
            retryAfterMs: active.count <= input.limit ? 0 : Math.max(0, active.resetTime - input.now),
            strategy: "fixed-window"
        };
    }
    async consumeSlidingWindow(input) {
        const cutoff = input.now - input.windowMs;
        const retained = (this.sliding.get(input.key) ?? []).filter((timestamp) => timestamp > cutoff);
        const allowed = retained.length < input.limit;
        if (allowed) {
            retained.push(input.now);
        }
        this.sliding.set(input.key, retained);
        const oldest = retained[0] ?? input.now;
        const resetTime = oldest + input.windowMs;
        return {
            allowed,
            key: input.key,
            limit: input.limit,
            remaining: Math.max(0, input.limit - retained.length),
            resetTime,
            retryAfterMs: allowed ? 0 : Math.max(0, resetTime - input.now),
            strategy: "sliding-window"
        };
    }
    async consumeTokenBucket(input) {
        const current = this.buckets.get(input.key) ?? { tokens: input.limit, updatedAt: input.now };
        const elapsed = Math.max(0, input.now - current.updatedAt);
        const available = Math.min(input.limit, current.tokens + elapsed * input.refillRatePerMs);
        const allowed = available >= input.cost;
        const nextTokens = allowed ? available - input.cost : available;
        this.buckets.set(input.key, {
            tokens: nextTokens,
            updatedAt: input.now
        });
        const retryAfterMs = allowed ? 0 : Math.ceil((input.cost - nextTokens) / input.refillRatePerMs);
        return {
            allowed,
            key: input.key,
            limit: input.limit,
            remaining: Math.max(0, Math.floor(nextTokens)),
            resetTime: input.now + Math.ceil((input.limit - nextTokens) / input.refillRatePerMs),
            retryAfterMs,
            strategy: "token-bucket"
        };
    }
}
