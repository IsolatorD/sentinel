import type { AlertPayload } from "@sentinel/shared";
import { describe, expect, it } from "vitest";
import { classifyHttpStatus } from "./delivery-error.js";
import {
	emailContent,
	headline,
	signWebhook,
	slackBody,
	webhookBody,
} from "./messages.js";

const payload = (over: Partial<AlertPayload> = {}): AlertPayload => ({
	kind: "alert",
	trigger: "new_issue",
	ruleName: "Production errors",
	organization: { id: "org1", name: "Acme", slug: "acme" },
	project: { id: "p1", name: "Storefront", slug: "storefront" },
	issue: {
		id: "i1",
		title: "TypeError: Cannot read properties of undefined",
		culprit: "computeTotal (cart.ts:42)",
		type: "TypeError",
		level: "error",
		eventCount: 7,
		firstSeen: "2026-10-09T12:00:00.000Z",
		lastSeen: "2026-10-09T12:05:00.000Z",
		environment: "production",
		release: "2.4.0",
		regressedInRelease: null,
	},
	url: "https://sentinel.example.com/acme/projects/storefront/issues/i1",
	...over,
});

describe("headline", () => {
	it("explica el motivo del aviso", () => {
		expect(headline(payload())).toBe("New issue");
		expect(
			headline(
				payload({
					trigger: "regression",
					issue: { ...payload().issue, regressedInRelease: "2.5.0" },
				}),
			),
		).toBe("Regression in 2.5.0");
		expect(headline(payload({ trigger: "regression" }))).toBe("Regression");
		expect(headline(payload({ kind: "test" }))).toBe(
			"Test alert from Sentinel",
		);
	});

	it("formatea la ventana de frecuencia con la unidad natural", () => {
		const f = (windowMinutes: number) =>
			headline(
				payload({
					trigger: "frequency",
					frequency: { count: 50, windowMinutes },
				}),
			);
		expect(f(1)).toBe("50 events in 1 minute");
		expect(f(10)).toBe("50 events in 10 minutes");
		expect(f(60)).toBe("50 events in 1 hour");
		expect(f(120)).toBe("50 events in 2 hours");
		expect(f(1440)).toBe("50 events in 1 day");
	});
});

describe("emailContent", () => {
	it("incluye proyecto, título, detalles y enlace", () => {
		const mail = emailContent(payload());
		expect(mail.subject).toBe(
			"[Storefront] New issue: TypeError: Cannot read properties of undefined",
		);
		for (const part of [
			"computeTotal (cart.ts:42)",
			"production",
			"2.4.0",
			"Production errors",
			payload().url,
		]) {
			expect(mail.text).toContain(part);
			expect(mail.html).toContain(part);
		}
	});

	it("escapa el HTML de contenido controlado por la app monitoreada", () => {
		const evil = payload({
			issue: {
				...payload().issue,
				title: '<img src=x onerror="alert(1)">',
				culprit: "<script>x</script>",
			},
			ruleName: '"><b>x</b>',
		});
		const mail = emailContent(evil);
		expect(mail.html).not.toContain("<img");
		expect(mail.html).not.toContain("<script>");
		expect(mail.html).toContain("&lt;img");
		expect(mail.html).not.toContain('"><b>');
	});

	it("recorta títulos enormes en el asunto", () => {
		const mail = emailContent(
			payload({ issue: { ...payload().issue, title: "x".repeat(1000) } }),
		);
		expect(mail.subject.length).toBeLessThan(220);
	});
});

describe("slackBody", () => {
	it("tiene texto de respaldo y bloques con el enlace al issue", () => {
		const body = slackBody(payload());
		expect(body.text).toContain("New issue");
		expect(body.text).toContain("Storefront");
		const section = body.blocks.find((b) => b.type === "section");
		expect(JSON.stringify(section)).toContain(payload().url);
		expect(JSON.stringify(section)).toContain("computeTotal");
	});

	it("escapa los caracteres que Slack interpreta (&, <, >)", () => {
		const body = slackBody(
			payload({ issue: { ...payload().issue, title: "<!channel> a & b" } }),
		);
		const text = JSON.stringify(body.blocks);
		expect(text).not.toContain("<!channel>");
		expect(text).toContain("&lt;!channel&gt; a &amp; b");
	});
});

describe("webhookBody y firma", () => {
	const now = new Date("2026-10-09T12:00:00.000Z");

	it("usa el nombre de evento según el disparador, y alert.test para las pruebas", () => {
		expect(webhookBody(payload(), "d1", now).event).toBe("issue.new");
		expect(
			webhookBody(payload({ trigger: "regression" }), "d1", now).event,
		).toBe("issue.regression");
		expect(
			webhookBody(payload({ trigger: "frequency" }), "d1", now).event,
		).toBe("issue.frequency");
		expect(webhookBody(payload({ kind: "test" }), "d1", now).event).toBe(
			"alert.test",
		);
	});

	it("incluye el id del envío, el momento y el enlace; la frecuencia solo si existe", () => {
		const body = webhookBody(payload(), "d1", now);
		expect(body).toMatchObject({
			delivery_id: "d1",
			timestamp: now.toISOString(),
			url: payload().url,
		});
		expect("frequency" in body).toBe(false);
		const withFreq = webhookBody(
			payload({
				trigger: "frequency",
				frequency: { count: 5, windowMinutes: 10 },
			}),
			"d1",
			now,
		);
		expect(withFreq.frequency).toEqual({ count: 5, windowMinutes: 10 });
	});

	it("la firma es determinista, depende del secreto, del momento y del cuerpo", () => {
		const a = signWebhook("secret", 1000, "{}");
		expect(a).toMatch(/^sha256=[0-9a-f]{64}$/);
		expect(signWebhook("secret", 1000, "{}")).toBe(a);
		expect(signWebhook("otro", 1000, "{}")).not.toBe(a);
		expect(signWebhook("secret", 1001, "{}")).not.toBe(a);
		expect(signWebhook("secret", 1000, '{"a":1}')).not.toBe(a);
	});

	it("coincide con una firma calculada de forma independiente", () => {
		// echo -n '1700000000.{"ok":true}' | openssl dgst -sha256 -hmac whsec_test
		expect(signWebhook("whsec_test", 1700000000, '{"ok":true}')).toBe(
			"sha256=85876387ad9d6be57a04653bc0729da757049f58afb10ba6cac3bedaecf4fda3",
		);
	});
});

describe("classifyHttpStatus", () => {
	it("éxito, reintento o rendirse", () => {
		expect(classifyHttpStatus(200)).toBe("ok");
		expect(classifyHttpStatus(204)).toBe("ok");
		expect(classifyHttpStatus(500)).toBe("retry");
		expect(classifyHttpStatus(503)).toBe("retry");
		expect(classifyHttpStatus(429)).toBe("retry");
		expect(classifyHttpStatus(408)).toBe("retry");
		expect(classifyHttpStatus(400)).toBe("permanent");
		expect(classifyHttpStatus(404)).toBe("permanent");
		expect(classifyHttpStatus(302)).toBe("permanent");
	});
});
