import { createRateLimiter } from "./core.js";
export function expressRateLimiter(options = {}) {
    const limiter = createRateLimiter(options);
    return async function rateLimitMiddleware(req, res, next) {
        const ctx = {
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
