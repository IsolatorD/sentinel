import { All, Controller, Inject, Req, Res } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Auth } from "./auth";
import { AUTH } from "./auth.constants";

// Better Auth expone un handler Web estándar (Request -> Response).
// Este controlador traduce entre Fastify y ese handler.
@Controller("auth")
export class AuthController {
	constructor(@Inject(AUTH) private readonly auth: Auth) {}

	@All("*")
	async handle(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
		const url = new URL(req.url, `${req.protocol}://${req.hostname}`);

		const headers = new Headers();
		for (const [key, value] of Object.entries(req.headers)) {
			if (Array.isArray(value)) {
				for (const v of value) headers.append(key, v);
			} else if (value !== undefined) {
				headers.set(key, value);
			}
		}

		const hasBody = req.method !== "GET" && req.method !== "HEAD";
		const request = new Request(url, {
			method: req.method,
			headers,
			body: hasBody && req.body ? JSON.stringify(req.body) : undefined,
		});

		const response = await this.auth.handler(request);

		reply.status(response.status);
		response.headers.forEach((value, key) => {
			if (key.toLowerCase() !== "set-cookie") reply.header(key, value);
		});
		const cookies = response.headers.getSetCookie();
		if (cookies.length > 0) reply.header("set-cookie", cookies);

		return reply.send(response.body ? await response.text() : null);
	}
}
