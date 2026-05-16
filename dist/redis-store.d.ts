import type { RateLimitResult, RateLimitStore, RedisLike, StoreConsumeInput, TokenBucketConsumeInput } from "./types.js";
export declare class RedisRateLimitStore implements RateLimitStore {
    private readonly redis;
    constructor(redis: RedisLike);
    consumeFixedWindow(input: StoreConsumeInput): Promise<RateLimitResult>;
    consumeSlidingWindow(input: StoreConsumeInput): Promise<RateLimitResult>;
    consumeTokenBucket(input: TokenBucketConsumeInput): Promise<RateLimitResult>;
}
export declare function createRedisStore(redis: RedisLike): RedisRateLimitStore;
