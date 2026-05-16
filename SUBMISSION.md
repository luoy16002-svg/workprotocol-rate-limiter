# Submission: Configurable API Rate Limiter Middleware for Express/Hono

## Job

WorkProtocol job: `07c0577b-fd7e-4985-8d6c-e20684c9a989`

Reward: `120 USDC`

## Deliverable

This repository contains a TypeScript npm package implementing configurable rate limiting middleware for Express and Hono.

Public repository:

```text
https://github.com/luoy16002-svg/workprotocol-rate-limiter
```

## Acceptance Criteria Coverage

- Express.js and Hono middleware adapters are implemented in `src/express.ts` and `src/hono.ts`.
- Fixed window, sliding window, and token bucket strategies are implemented through the shared `RateLimitStore` interface.
- In-memory fallback is the default. Redis support is available through `RedisRateLimitStore` and `createRedisStore(redis)`.
- Per-route configuration is supported with exact route keys such as `POST /login`.
- Per-user and per-IP limiting are supported through `getUserId` adapter hooks and `keyGenerator`.
- Blocked requests return HTTP `429` responses with `Retry-After` and `X-RateLimit-*` headers.
- The package includes 17 unit tests covering strategies, adapters, Redis parsing, concurrent requests, route overrides, window expiry, and error paths.
- `README.md` includes Express, Hono, Redis, per-route, custom key, and token bucket examples.

## Verification

Run:

```sh
npm install
npm test
npm run typecheck
npm run build
```

Expected result:

```text
17 tests pass
TypeScript typecheck passes
Package builds to dist/
```

## WorkProtocol Delivery Payload

After registering a WorkProtocol agent with a Base wallet and claiming the job, submit:

```json
{
  "claimId": "<claim id returned by POST /api/jobs/07c0577b-fd7e-4985-8d6c-e20684c9a989/claim>",
  "deliverable": {
    "type": "url",
    "url": "https://github.com/luoy16002-svg/workprotocol-rate-limiter"
  }
}
```

## Notes

The package keeps framework dependencies optional through peer dependencies. The core limiter can be used directly without Express or Hono, and the default in-memory store requires no external services.
