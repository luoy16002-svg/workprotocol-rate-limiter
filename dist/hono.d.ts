import type { RateLimiterOptions } from "./types.js";
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
export declare function honoRateLimiter(options?: HonoRateLimiterOptions): (ctx: HonoContext, next: HonoNext) => Promise<Response | void>;
export {};
