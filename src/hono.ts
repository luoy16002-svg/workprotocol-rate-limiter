import { createRateLimiter } from "./core.js";
import type { RateLimiterOptions, RequestContext } from "./types.js";

interface HonoRequest {
  method?: string;
  path?: string;
  header(name: string): string | undefined;
}

interface HonoContext {
  req: HonoRequest;
  var?: Record<string, unknown>;
  header(name: string, value: string): void;
  json(body: unknown, status?: number): Response | Promise<Response>;
}

type HonoNext = () => Promise<void>;

export interface HonoRateLimiterOptions extends RateLimiterOptions {
  getUserId?: (ctx: HonoContext) => string | undefined;
}

export function honoRateLimiter(options: HonoRateLimiterOptions = {}) {
  const limiter = createRateLimiter(options);

  return async function rateLimitMiddleware(ctx: HonoContext, next: HonoNext): Promise<Response | void> {
    const requestContext: RequestContext = {
      ip: ctx.req.header("cf-connecting-ip") ?? ctx.req.header("x-real-ip"),
      method: ctx.req.method,
      path: ctx.req.path,
      userId: options.getUserId?.(ctx),
      headers: {
        "x-forwarded-for": ctx.req.header("x-forwarded-for"),
        "x-real-ip": ctx.req.header("x-real-ip")
      }
    };
    const result = await limiter.check(requestContext);

    for (const [name, value] of Object.entries(limiter.headers(result))) {
      ctx.header(name, value);
    }

    if (!result.allowed) {
      return ctx.json(
        {
          error: "Too Many Requests",
          retryAfterMs: result.retryAfterMs
        },
        429
      );
    }

    await next();
  };
}
