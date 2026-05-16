export type RateLimitStrategy = "fixed-window" | "sliding-window" | "token-bucket";

export interface RequestContext {
  ip?: string;
  method?: string;
  path?: string;
  routeId?: string;
  userId?: string;
  headers?: Record<string, string | string[] | undefined>;
}

export interface RateLimitResult {
  allowed: boolean;
  key: string;
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfterMs: number;
  strategy: RateLimitStrategy;
}

export interface StoreConsumeInput {
  key: string;
  limit: number;
  windowMs: number;
  now: number;
}

export interface TokenBucketConsumeInput extends StoreConsumeInput {
  refillRatePerMs: number;
  cost: number;
}

export interface RateLimitStore {
  consumeFixedWindow(input: StoreConsumeInput): Promise<RateLimitResult>;
  consumeSlidingWindow(input: StoreConsumeInput): Promise<RateLimitResult>;
  consumeTokenBucket(input: TokenBucketConsumeInput): Promise<RateLimitResult>;
}

export interface RedisLike {
  eval(script: string, numberOfKeys: number, ...args: Array<string | number>): Promise<unknown>;
}

export interface RouteLimitOptions {
  limit?: number;
  windowMs?: number;
  strategy?: RateLimitStrategy;
  keyPrefix?: string;
  keyGenerator?: (ctx: RequestContext) => string | Promise<string>;
  tokenBucket?: {
    refillRatePerMs?: number;
    cost?: number;
  };
}

export interface RateLimiterOptions extends RouteLimitOptions {
  store?: RateLimitStore;
  redis?: RedisLike;
  routes?: Record<string, RouteLimitOptions>;
  clock?: () => number;
}

export type HeaderMap = Record<string, string>;

export interface RateLimiter {
  check(ctx: RequestContext): Promise<RateLimitResult>;
  headers(result: RateLimitResult): HeaderMap;
}
