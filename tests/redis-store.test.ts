import { describe, expect, it } from "vitest";
import { RedisRateLimitStore } from "../src/redis-store.js";

describe("RedisRateLimitStore", () => {
  it("parses fixed-window script responses", async () => {
    const redis = new FakeRedis([2, 30_000]);
    const store = new RedisRateLimitStore(redis);

    const result = await store.consumeFixedWindow({
      key: "rl:fixed",
      limit: 3,
      windowMs: 60_000,
      now: 1_000
    });

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
    expect(result.resetTime).toBe(31_000);
    expect(redis.calls[0]?.args).toEqual(["rl:fixed", 60_000]);
  });

  it("parses sliding-window blocked responses", async () => {
    const redis = new FakeRedis([0, 3, 1_000]);
    const store = new RedisRateLimitStore(redis);

    const result = await store.consumeSlidingWindow({
      key: "rl:sliding",
      limit: 3,
      windowMs: 10_000,
      now: 9_000
    });

    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBe(2_000);
    expect(result.remaining).toBe(0);
  });

  it("parses token-bucket script responses", async () => {
    const redis = new FakeRedis([1, 4]);
    const store = new RedisRateLimitStore(redis);

    const result = await store.consumeTokenBucket({
      key: "rl:bucket",
      limit: 5,
      windowMs: 1_000,
      now: 2_000,
      refillRatePerMs: 0.01,
      cost: 1
    });

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(redis.calls[0]?.args.slice(0, 5)).toEqual(["rl:bucket", 5, 2_000, 0.01, 1]);
  });

  it("rejects malformed Redis script responses", async () => {
    const redis = new FakeRedis("bad");
    const store = new RedisRateLimitStore(redis);

    await expect(
      store.consumeFixedWindow({
        key: "rl:bad",
        limit: 1,
        windowMs: 1_000,
        now: 1_000
      })
    ).rejects.toThrow("non-array");
  });
});

class FakeRedis {
  calls: Array<{ script: string; keys: number; args: Array<string | number> }> = [];

  constructor(private readonly response: unknown) {}

  async eval(script: string, keys: number, ...args: Array<string | number>): Promise<unknown> {
    this.calls.push({ script, keys, args });
    return this.response;
  }
}
