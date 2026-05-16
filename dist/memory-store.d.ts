import type { RateLimitResult, RateLimitStore, StoreConsumeInput, TokenBucketConsumeInput } from "./types.js";
export declare class MemoryRateLimitStore implements RateLimitStore {
    private readonly fixed;
    private readonly sliding;
    private readonly buckets;
    consumeFixedWindow(input: StoreConsumeInput): Promise<RateLimitResult>;
    consumeSlidingWindow(input: StoreConsumeInput): Promise<RateLimitResult>;
    consumeTokenBucket(input: TokenBucketConsumeInput): Promise<RateLimitResult>;
}
