import { Inject, Injectable } from "@nestjs/common";
import type { Redis } from "ioredis";
import { REDIS } from "../redis/redis.module.js";

export interface RateLimitResult {
	allowed: boolean;
	retryAfterSeconds: number;
}

// Limitador de ventana fija sobre Redis. Simple, barato y suficiente para ingesta.
@Injectable()
export class RateLimiterService {
	constructor(@Inject(REDIS) private readonly redis: Redis) {}

	private windowKey(bucket: string, windowSeconds: number) {
		const window = Math.floor(Date.now() / (windowSeconds * 1000));
		return `rl:${bucket}:${window}`;
	}

	private retryAfter(windowSeconds: number) {
		const elapsed = (Date.now() / 1000) % windowSeconds;
		return Math.max(1, Math.ceil(windowSeconds - elapsed));
	}

	/** Cuenta un hit en el bucket y dice si sigue dentro del límite. */
	async hit(
		bucket: string,
		limit: number,
		windowSeconds: number,
	): Promise<RateLimitResult> {
		const key = this.windowKey(bucket, windowSeconds);
		const results = await this.redis
			.multi()
			.incr(key)
			.expire(key, windowSeconds * 2)
			.exec();
		const count = Number(results?.[0]?.[1] ?? 0);
		return {
			allowed: count <= limit,
			retryAfterSeconds: this.retryAfter(windowSeconds),
		};
	}
}
