import { describe, expect, it } from "vitest";
import { expressRateLimiter } from "../src/express.js";
import { honoRateLimiter } from "../src/hono.js";

describe("framework adapters", () => {
  it("passes allowed Express requests to next", async () => {
    const middleware = expressRateLimiter({ limit: 1, windowMs: 1_000, clock: () => 1_000 });
    const res = createExpressResponse();
    let nextCalls = 0;

    await middleware(
      { ip: "198.51.100.1", method: "GET", path: "/status", headers: {} },
      res,
      () => {
        nextCalls += 1;
      }
    );

    expect(nextCalls).toBe(1);
    expect(res.headers["X-RateLimit-Limit"]).toBe("1");
    expect(res.statusCode).toBe(200);
  });

  it("returns a 429 JSON response for blocked Express requests", async () => {
    const middleware = expressRateLimiter({ limit: 1, windowMs: 1_000, clock: () => 1_000 });
    const req = { ip: "198.51.100.1", method: "GET", path: "/status", headers: {} };
    const first = createExpressResponse();
    const second = createExpressResponse();

    await middleware(req, first, () => undefined);
    await middleware(req, second, () => undefined);

    expect(second.statusCode).toBe(429);
    expect(second.body).toEqual({ error: "Too Many Requests", retryAfterMs: 1_000 });
    expect(second.headers["Retry-After"]).toBe("1");
  });

  it("uses Express getUserId for per-user limits", async () => {
    const middleware = expressRateLimiter({
      limit: 1,
      windowMs: 1_000,
      getUserId: (req) => req.user?.id,
      clock: () => 1_000
    });
    const reqA = { ip: "198.51.100.1", method: "GET", path: "/me", headers: {}, user: { id: "a" } };
    const reqB = { ip: "198.51.100.1", method: "GET", path: "/me", headers: {}, user: { id: "b" } };

    await middleware(reqA, createExpressResponse(), () => undefined);
    const blockedA = createExpressResponse();
    await middleware(reqA, blockedA, () => undefined);
    const allowedB = createExpressResponse();
    let nextCalls = 0;
    await middleware(reqB, allowedB, () => {
      nextCalls += 1;
    });

    expect(blockedA.statusCode).toBe(429);
    expect(nextCalls).toBe(1);
  });

  it("passes allowed Hono requests to next", async () => {
    const middleware = honoRateLimiter({ limit: 1, windowMs: 1_000, clock: () => 1_000 });
    const ctx = createHonoContext("GET", "/status", { "x-real-ip": "198.51.100.2" });
    let nextCalls = 0;

    await middleware(ctx, async () => {
      nextCalls += 1;
    });

    expect(nextCalls).toBe(1);
    expect(ctx.headers["X-RateLimit-Limit"]).toBe("1");
  });

  it("returns a 429 JSON response for blocked Hono requests", async () => {
    const middleware = honoRateLimiter({ limit: 1, windowMs: 1_000, clock: () => 1_000 });
    const first = createHonoContext("GET", "/status", { "x-real-ip": "198.51.100.2" });
    const second = createHonoContext("GET", "/status", { "x-real-ip": "198.51.100.2" });

    await middleware(first, async () => undefined);
    const response = await middleware(second, async () => undefined);

    expect(response).toBeInstanceOf(Response);
    expect(response?.status).toBe(429);
    expect(second.headers["Retry-After"]).toBe("1");
  });
});

function createExpressResponse() {
  return {
    headers: {} as Record<string, string>,
    statusCode: 200,
    body: undefined as unknown,
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
    }
  };
}

function createHonoContext(method: string, path: string, headers: Record<string, string>) {
  return {
    headers: {} as Record<string, string>,
    req: {
      method,
      path,
      header(name: string) {
        return headers[name.toLowerCase()];
      }
    },
    header(name: string, value: string) {
      this.headers[name] = value;
    },
    json(body: unknown, status = 200) {
      return new Response(JSON.stringify(body), { status });
    }
  };
}
