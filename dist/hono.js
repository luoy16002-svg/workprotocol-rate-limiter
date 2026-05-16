import { createRateLimiter } from "./core.js";
export function honoRateLimiter(options = {}) {
    const limiter = createRateLimiter(options);
    return async function rateLimitMiddleware(ctx, next) {
        const requestContext = {
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
            return ctx.json({
                error: "Too Many Requests",
                retryAfterMs: result.retryAfterMs
            }, 429);
        }
        await next();
    };
}
