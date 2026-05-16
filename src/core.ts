import { MemoryRateLimitStore } from "./memory-store.js";
import { RedisRateLimitStore } from "./redis-store.js";
import type {
  HeaderMap,
  RateLimiter,
  RateLimiterOptions,
  RequestContext,
  RateLimitStrategy,
  RouteLimitOptions
} from "./types.js";

const DEFAULT_LIMIT = 100;
const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_PREFIX = "rate-limit";

interface ResolvedRouteOptions {
  limit: number;
  windowMs: number;
  strategy: RateLimitStrategy;
  keyPrefix: string;
  keyGenerator: (ctx: RequestContext) => string | Promise<string>;
  tokenBucket: {
    refillRatePerMs: number;
    cost: number;
  };
}

function headerValue(ctx: RequestContext, name: string): string | undefined {
  const value = ctx.headers?.[name] ?? ctx.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function defaultKey(ctx: RequestContext): string {
  const forwardedFor = headerValue(ctx, "x-forwarded-for")?.split(",")[0]?.trim();
  const ip = ctx.ip ?? forwardedFor ?? headerValue(ctx, "x-real-ip") ?? "anonymous";
  const user = ctx.userId ? `user:${ctx.userId}` : `ip:${ip}`;
  return `${ctx.method ?? "ANY"}:${ctx.routeId ?? ctx.path ?? "/"}:${user}`;
}

function routeKey(ctx: RequestContext): string | undefined {
  const method = ctx.method?.toUpperCase();
  const path = ctx.routeId ?? ctx.path;
  if (!path) {
    return undefined;
  }

  return method ? `${method} ${path}` : path;
}

function mergeRouteOptions(base: RateLimiterOptions, route?: RouteLimitOptions): ResolvedRouteOptions {
  return {
    limit: route?.limit ?? base.limit ?? DEFAULT_LIMIT,
    windowMs: route?.windowMs ?? base.windowMs ?? DEFAULT_WINDOW_MS,
    strategy: route?.strategy ?? base.strategy ?? "fixed-window",
    keyPrefix: route?.keyPrefix ?? base.keyPrefix ?? DEFAULT_PREFIX,
    keyGenerator: route?.keyGenerator ?? base.keyGenerator ?? defaultKey,
    tokenBucket: {
      refillRatePerMs:
        route?.tokenBucket?.refillRatePerMs ??
        base.tokenBucket?.refillRatePerMs ??
        ((route?.limit ?? base.limit ?? DEFAULT_LIMIT) / (route?.windowMs ?? base.windowMs ?? DEFAULT_WINDOW_MS)),
      cost: route?.tokenBucket?.cost ?? base.tokenBucket?.cost ?? 1
    }
  };
}

function findRouteOptions(ctx: RequestContext, options: RateLimiterOptions): RouteLimitOptions | undefined {
  const key = routeKey(ctx);
  if (!key || !options.routes) {
    return undefined;
  }

  return options.routes[key] ?? options.routes[ctx.routeId ?? ""] ?? options.routes[ctx.path ?? ""];
}

export function createRateLimiter(options: RateLimiterOptions = {}): RateLimiter {
  const store = options.store ?? (options.redis ? new RedisRateLimitStore(options.redis) : new MemoryRateLimitStore());
  const clock = options.clock ?? Date.now;

  return {
    async check(ctx: RequestContext) {
      const route = findRouteOptions(ctx, options);
      const resolved = mergeRouteOptions(options, route);
      const rawKey = await resolved.keyGenerator(ctx);
      const key = `${resolved.keyPrefix}:${rawKey}`;
      const now = clock();

      if (resolved.strategy === "sliding-window") {
        return store.consumeSlidingWindow({ key, limit: resolved.limit, windowMs: resolved.windowMs, now });
      }

      if (resolved.strategy === "token-bucket") {
        return store.consumeTokenBucket({
          key,
          limit: resolved.limit,
          windowMs: resolved.windowMs,
          now,
          refillRatePerMs: resolved.tokenBucket.refillRatePerMs,
          cost: resolved.tokenBucket.cost
        });
      }

      return store.consumeFixedWindow({ key, limit: resolved.limit, windowMs: resolved.windowMs, now });
    },
    headers(result): HeaderMap {
      const resetSeconds = Math.ceil(result.resetTime / 1000).toString();
      const headers: HeaderMap = {
        "X-RateLimit-Limit": result.limit.toString(),
        "X-RateLimit-Remaining": result.remaining.toString(),
        "X-RateLimit-Reset": resetSeconds
      };

      if (!result.allowed) {
        headers["Retry-After"] = Math.ceil(result.retryAfterMs / 1000).toString();
      }

      return headers;
    }
  };
}
