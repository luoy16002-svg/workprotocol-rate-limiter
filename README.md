# WorkProtocol Rate Limiter Middleware

Configurable TypeScript rate limiting middleware for Express and Hono.

## Features

- Express and Hono adapters over the same core limiter.
- Fixed window, sliding window, and token bucket strategies.
- In-memory store by default.
- Optional Redis store for shared deployments.
- Per-route, per-user, and per-IP limiting.
- Standard `429`, `Retry-After`, and `X-RateLimit-*` headers.
- Fully typed public API and unit tests.

## Install

```sh
npm install @workprotocol/rate-limiter-middleware
```

For Redis-backed deployments, also install `ioredis` and pass a Redis client:

```sh
npm install ioredis
```

## Express

```ts
import express from "express";
import { expressRateLimiter } from "@workprotocol/rate-limiter-middleware";

const app = express();

app.use(
  expressRateLimiter({
    limit: 100,
    windowMs: 60_000,
    strategy: "fixed-window",
    getUserId: (req) => req.user?.id
  })
);
```

## Hono

```ts
import { Hono } from "hono";
import { honoRateLimiter } from "@workprotocol/rate-limiter-middleware";

const app = new Hono();

app.use(
  "*",
  honoRateLimiter({
    limit: 100,
    windowMs: 60_000,
    strategy: "sliding-window"
  })
);
```

## Redis Store

```ts
import Redis from "ioredis";
import { createRedisStore, expressRateLimiter } from "@workprotocol/rate-limiter-middleware";

const redis = new Redis(process.env.REDIS_URL);

app.use(
  expressRateLimiter({
    store: createRedisStore(redis),
    strategy: "token-bucket",
    limit: 100,
    windowMs: 60_000
  })
);
```

If no store or Redis client is provided, the limiter automatically uses the in-memory backend.

## Per-Route Configuration

```ts
app.use(
  expressRateLimiter({
    limit: 100,
    windowMs: 60_000,
    routes: {
      "POST /login": {
        limit: 5,
        windowMs: 60_000,
        strategy: "fixed-window"
      },
      "GET /search": {
        limit: 30,
        windowMs: 10_000,
        strategy: "sliding-window"
      }
    }
  })
);
```

## Custom Keys

```ts
expressRateLimiter({
  keyGenerator: (ctx) => `tenant:${ctx.headers?.["x-tenant-id"] ?? "public"}:${ctx.userId ?? ctx.ip}`
});
```

By default, the key is built from method, path, and user ID when available. If no user ID is available, it falls back to the request IP address.

## Token Bucket

```ts
expressRateLimiter({
  strategy: "token-bucket",
  limit: 50,
  windowMs: 60_000,
  tokenBucket: {
    refillRatePerMs: 50 / 60_000,
    cost: 1
  }
});
```

## Development

```sh
npm install
npm test
npm run typecheck
npm run build
```

The test suite covers all strategies, route overrides, user/IP key separation, Express/Hono adapters, concurrent requests, and Redis response parsing.
