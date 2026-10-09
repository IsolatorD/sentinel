import {
	type CallHandler,
	type ExecutionContext,
	Injectable,
	type NestInterceptor,
	SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
	type MessageCode,
	type MessageParams,
	translate,
} from "@sentinel/shared";
import type { FastifyReply, FastifyRequest } from "fastify";
import { map, type Observable } from "rxjs";
import { requestLocale } from "./locale.js";

/** Cabecera con el aviso de éxito ya traducido (URL-encoded: las cabeceras son ASCII). */
export const NOTICE_HEADER = "X-Sentinel-Message";
/** Cabecera con el código del aviso: el panel lo usa para traducir si no le llega el texto. */
export const NOTICE_CODE_HEADER = "X-Sentinel-Message-Code";

export interface NoticeSpec {
	code: MessageCode;
	params?: MessageParams;
}

export type NoticeResolver = (context: {
	request: FastifyRequest;
	result: unknown;
}) => NoticeSpec | undefined;

const NOTICE_KEY = "sentinel:notice";

/**
 * Aviso de éxito de una operación (p. ej. "Issue resuelto"). Puede ser fijo o decidirse según la
 * petición y el resultado. Si la operación falla no se envía nada.
 */
export const Notice = (spec: NoticeSpec | NoticeResolver) =>
	SetMetadata(NOTICE_KEY, spec);

@Injectable()
export class NoticeInterceptor implements NestInterceptor {
	constructor(private readonly reflector: Reflector) {}

	intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
		const spec = this.reflector.get<NoticeSpec | NoticeResolver | undefined>(
			NOTICE_KEY,
			context.getHandler(),
		);
		if (!spec) return next.handle();

		const http = context.switchToHttp();
		const request = http.getRequest<FastifyRequest>();
		const reply = http.getResponse<FastifyReply>();
		return next.handle().pipe(
			map((result) => {
				const notice =
					typeof spec === "function" ? spec({ request, result }) : spec;
				if (notice) {
					const text = translate(
						requestLocale(request.headers),
						notice.code,
						notice.params,
					);
					reply.header(NOTICE_HEADER, encodeURIComponent(text));
					reply.header(NOTICE_CODE_HEADER, notice.code);
				}
				return result;
			}),
		);
	}
}
