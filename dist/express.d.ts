import type { RateLimiterOptions } from "./types.js";
interface ExpressRequest {
    ip?: string;
    method?: string;
    path?: string;
    originalUrl?: string;
    route?: {
        path?: string;
    };
    headers?: Record<string, string | string[] | undefined>;
    user?: {
        id?: string;
    };
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
export declare function expressRateLimiter(options?: ExpressRateLimiterOptions): (req: ExpressRequest, res: ExpressResponse, next: ExpressNext) => Promise<void>;
export {};
