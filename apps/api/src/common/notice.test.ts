import { Reflector } from "@nestjs/core";
import { of } from "rxjs";
import { describe, expect, it, vi } from "vitest";
import {
	NOTICE_CODE_HEADER,
	NOTICE_HEADER,
	Notice,
	NoticeInterceptor,
} from "./notice.js";

function run(
	spec: Parameters<typeof Notice>[0] | undefined,
	headers: Record<string, string> = {},
	result: unknown = { ok: true },
	body: unknown = {},
) {
	const sent: Record<string, string> = {};
	const handler = () => {};
	if (spec) Notice(spec)(handler as never, "x", { value: handler } as never);
	const context = {
		getHandler: () => handler,
		switchToHttp: () => ({
			getRequest: () => ({ headers, body }),
			getResponse: () => ({ header: (k: string, v: string) => (sent[k] = v) }),
		}),
	};
	const out: unknown[] = [];
	new NoticeInterceptor(new Reflector())
		.intercept(context as never, { handle: () => of(result) } as never)
		.subscribe((r) => out.push(r));
	return { sent, out };
}

describe("NoticeInterceptor", () => {
	it("sin aviso declarado no toca la respuesta", () => {
		const { sent, out } = run(undefined);
		expect(sent).toEqual({});
		expect(out).toEqual([{ ok: true }]);
	});

	it("traduce el aviso al idioma de la petición y lo codifica para la cabecera", () => {
		const es = run(
			{ code: "NOTICE_PROJECT_CREATED", params: { name: "Tienda ñandú" } },
			{ "accept-language": "es-AR,es;q=0.9" },
		);
		expect(decodeURIComponent(es.sent[NOTICE_HEADER])).toBe(
			"Proyecto «Tienda ñandú» creado",
		);
		expect(es.sent[NOTICE_HEADER]).toMatch(/^[\x20-\x7e]+$/); // solo ASCII
		expect(es.sent[NOTICE_CODE_HEADER]).toBe("NOTICE_PROJECT_CREATED");

		const en = run(
			{ code: "NOTICE_PROJECT_UPDATED" },
			{ "accept-language": "en" },
		);
		expect(decodeURIComponent(en.sent[NOTICE_HEADER])).toBe("Project updated");
	});

	it("sin idioma usa el inglés", () => {
		const { sent } = run({ code: "NOTICE_ISSUE_DELETED" });
		expect(decodeURIComponent(sent[NOTICE_HEADER])).toBe("Issue deleted");
	});

	it("un aviso dinámico decide según la petición y el resultado, o no envía ninguno", () => {
		const resolver = vi.fn(
			({ request }: { request: { body: { status?: string } } }) =>
				request.body.status === "resolved"
					? { code: "NOTICE_ISSUE_RESOLVED" as const }
					: undefined,
		);
		const yes = run(resolver as never, {}, {}, { status: "resolved" });
		expect(yes.sent[NOTICE_CODE_HEADER]).toBe("NOTICE_ISSUE_RESOLVED");
		const no = run(resolver as never, {}, {}, { status: "otro" });
		expect(no.sent).toEqual({});
	});

	it("devuelve el resultado sin cambios", () => {
		expect(run({ code: "NOTICE_KEY_CREATED" }, {}, { id: 7 }).out).toEqual([
			{ id: 7 },
		]);
	});
});
