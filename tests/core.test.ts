import { describe, expect, it } from "vitest";
import { createRateLimiter } from "../src/core.js";

const ctx = { method: "GET", path: "/api", ip: "203.0.113.7" };

describe("rate limiter core", () => {
  it("allows requests up to the fixed-window limit", async () => {
    let now = 1_000;
    const limiter = createRateLimiter({ limit: 2, windowMs: 1_000, clock: () => now });

    expect((await limiter.check(ctx)).allowed).toBe(true);
    const second = await limiter.check(ctx);
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(0);

    const third = await limiter.check(ctx);
    expect(third.allowed).toBe(false);
    expect(third.retryAfterMs).toBe(1_000);

    now = 2_001;
    expect((await limiter.check(ctx)).allowed).toBe(true);
  });

  it("handles concurrent fixed-window requests deterministically", async () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 1_000, clock: () => 1_000 });
    const results = await Promise.all(Array.from({ length: 6 }, () => limiter.check(ctx)));

    expect(results.filter((result) => result.allowed)).toHaveLength(3);
    expect(results.filter((result) => !result.allowed)).toHaveLength(3);
  });

  it("separates keys by route and IP by default", async () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1_000, clock: () => 1_000 });

    expect((await limiter.check({ ...ctx, path: "/a" })).allowed).toBe(true);
    expect((await limiter.check({ ...ctx, path: "/a" })).allowed).toBe(false);
    expect((await limiter.check({ ...ctx, path: "/b" })).allowed).toBe(true);
    expect((await limiter.check({ ...ctx, path: "/a", ip: "203.0.113.8" })).allowed).toBe(true);
  });

  it("supports a custom key generator for per-user limits", async () => {
    const limiter = createRateLimiter({
      limit: 1,
      windowMs: 1_000,
      keyGenerator: (request) => `user:${request.userId ?? "guest"}`,
      clock: () => 1_000
    });

    expect((await limiter.check({ ...ctx, userId: "u1" })).allowed).toBe(true);
    expect((await limiter.check({ ...ctx, userId: "u1" })).allowed).toBe(false);
    expect((await limiter.check({ ...ctx, userId: "u2" })).allowed).toBe(true);
  });

  it("applies exact per-route overrides", async () => {
    const limiter = createRateLimiter({
      limit: 5,
      windowMs: 1_000,
      routes: {
        "POST /login": { limit: 1 }
      },
      clock: () => 1_000
    });

    expect((await limiter.check({ ...ctx, method: "POST", path: "/login" })).allowed).toBe(true);
    expect((await limiter.check({ ...ctx, method: "POST", path: "/login" })).allowed).toBe(false);
    expect((await limiter.check({ ...ctx, method: "GET", path: "/login" })).allowed).toBe(true);
  });

  it("evicts expired entries from the sliding window", async () => {
    let now = 1_000;
    const limiter = createRateLimiter({
      strategy: "sliding-window",
      limit: 2,
      windowMs: 100,
      clock: () => now
    });

    expect((await limiter.check(ctx)).allowed).toBe(true);
    now = 1_050;
    expect((await limiter.check(ctx)).allowed).toBe(true);
    now = 1_075;
    const blocked = await limiter.check(ctx);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBe(25);

    now = 1_101;
    expect((await limiter.check(ctx)).allowed).toBe(true);
  });

  it("refills token buckets over time", async () => {
    let now = 1_000;
    const limiter = createRateLimiter({
      strategy: "token-bucket",
      limit: 2,
      windowMs: 1_000,
      tokenBucket: { refillRatePerMs: 0.001 },
      clock: () => now
    });

    expect((await limiter.check(ctx)).allowed).toBe(true);
    expect((await limiter.check(ctx)).allowed).toBe(true);
    expect((await limiter.check(ctx)).allowed).toBe(false);

    now = 2_000;
    expect((await limiter.check(ctx)).allowed).toBe(true);
  });

  it("emits standard rate limit headers", async () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1_000, clock: () => 1_000 });
    await limiter.check(ctx);
    const blocked = await limiter.check(ctx);

    expect(limiter.headers(blocked)).toEqual({
      "Retry-After": "1",
      "X-RateLimit-Limit": "1",
      "X-RateLimit-Remaining": "0",
      "X-RateLimit-Reset": "2"
    });
  });
});
