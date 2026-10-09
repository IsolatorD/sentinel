import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Params } from "nestjs-pino";

const SECRET_QUERY_PARAMS = /([?&](?:sentinel_key|token|key)=)[^&#]*/gi;

/** La clave de la DSN puede viajar en la query (sendBeacon): nunca debe llegar a los logs. */
export function sanitizeUrl(url: string | undefined): string {
	return (url ?? "").replace(SECRET_QUERY_PARAMS, "$1[redacted]");
}

/** Reutiliza el x-request-id entrante (limitado) o genera uno nuevo. */
export function resolveRequestId(
	header: string | string[] | undefined,
): string {
	const incoming = Array.isArray(header) ? header[0] : header;
	return incoming && /^[\w.-]{1,64}$/.test(incoming) ? incoming : randomUUID();
}

export function buildLoggerParams(options: {
	nodeEnv: string;
	level: string;
}): Params {
	const pretty = options.nodeEnv === "development";
	return {
		pinoHttp: {
			level: options.level,
			genReqId: (req: IncomingMessage, res: ServerResponse) => {
				const id = resolveRequestId(req.headers["x-request-id"]);
				res.setHeader("x-request-id", id);
				return id;
			},
			redact: {
				paths: [
					"req.headers.authorization",
					"req.headers.cookie",
					'req.headers["x-sentinel-key"]',
					'res.headers["set-cookie"]',
				],
				censor: "[redacted]",
			},
			serializers: {
				req: (req: {
					id: string;
					method: string;
					url: string;
					remoteAddress?: string;
				}) => ({
					id: req.id,
					method: req.method,
					url: sanitizeUrl(req.url),
					ip: req.remoteAddress,
				}),
				res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
			},
			customLogLevel: (_req, res, err) =>
				err || res.statusCode >= 500
					? "error"
					: res.statusCode >= 400
						? "warn"
						: "info",
			autoLogging: { ignore: (req) => req.url === "/api/health" },
			transport: pretty
				? {
						target: "pino-pretty",
						options: { singleLine: true, colorize: true },
					}
				: undefined,
		},
	};
}
