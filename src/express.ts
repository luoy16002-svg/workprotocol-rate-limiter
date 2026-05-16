import { createRateLimiter } from "./core.js";
import type { RateLimiterOptions, RequestContext } from "./types.js";

interface ExpressRequest {
  ip?: string;
  method?: string;
  path?: string;
  originalUrl?: string;
  route?: { path?: string };
  headers?: Record<string, string | string[] | undefined>;
  user?: { id?: string };
}

interface ExpressResponse {
  setHeader(name: string, value: string): void;
  status(code: number): ExpressResponse;
  json(body: unknown): void;
}

type ExpressNext = () => void;

export interface ExpressRateLimiterOptions extends RateLimiterOptions {
  getUserId?: (req: ExpressRequest) => string | undefined;
}

export function expressRateLimiter(options: ExpressRateLimiterOptions = {}) {
  const limiter = createRateLimiter(options);

  return async function rateLimitMiddleware(req: ExpressRequest, res: ExpressResponse, next: ExpressNext): Promise<void> {
    const ctx: RequestContext = {
      ip: req.ip,
      method: req.method,
      path: req.path ?? req.originalUrl,
      routeId: req.route?.path,
      userId: options.getUserId?.(req) ?? req.user?.id,
      headers: req.headers
    };
    const result = await limiter.check(ctx);

    for (const [name, value] of Object.entries(limiter.headers(result))) {
      res.setHeader(name, value);
    }

    if (!result.allowed) {
      res.status(429).json({
        error: "Too Many Requests",
        retryAfterMs: result.retryAfterMs
      });
      return;
    }

    next();
  };
}
