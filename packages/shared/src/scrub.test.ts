import { describe, expect, it } from "vitest";
import { FILTERED, isSensitiveKey, scrubEvent, scrubText } from "./scrub.js";

describe("isSensitiveKey", () => {
	it("reconoce secretos con cualquier estilo de escritura", () => {
		for (const key of [
			"password",
			"Password",
			"user_password",
			"confirmPassword",
			"api_key",
			"X-Api-Key",
			"apiKey",
			"accessToken",
			"refresh-token",
			"Authorization",
			"Cookie",
			"set-cookie",
			"client_secret",
			"credit_card",
			"cardNumber",
			"CVV",
			"ssn",
			"auth",
			"csrfToken",
			"private_key",
		]) {
			expect(isSensitiveKey(key), key).toBe(true);
		}
	});

	it("no marca claves normales", () => {
		for (const key of [
			"author",
			"username",
			"email",
			"url",
			"method",
			"message",
			"authority",
			"cartId",
			"status",
			"description",
			"name",
		]) {
			expect(isSensitiveKey(key), key).toBe(false);
		}
	});
});

describe("scrubText", () => {
	it("filtra JWT y cabeceras Bearer/Basic", () => {
		const jwt =
			"eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk";
		expect(scrubText(`token ${jwt} expired`)).toBe(`token ${FILTERED} expired`);
		expect(scrubText("Authorization: Bearer abc123def456ghi")).toBe(
			`Authorization: Bearer ${FILTERED}`,
		);
		expect(scrubText("basic dXNlcjpwYXNzd29yZA==")).toBe(`basic ${FILTERED}`);
	});

	it("filtra tarjetas válidas (Luhn), con o sin separadores, y deja pasar números normales", () => {
		expect(scrubText("pago con 4242 4242 4242 4242 rechazado")).toBe(
			`pago con ${FILTERED} rechazado`,
		);
		expect(scrubText("4242-4242-4242-4242")).toBe(FILTERED);
		expect(scrubText("5555555555554444")).toBe(FILTERED);
		expect(scrubText("378282246310005")).toBe(FILTERED); // Amex (15)
		// No pasa Luhn: un id cualquiera no se toca.
		expect(scrubText("pedido 4242424242424241")).toBe(
			"pedido 4242424242424241",
		);
		// Más corto, más largo o dentro de un número mayor.
		expect(scrubText("1234567")).toBe("1234567");
		expect(scrubText("99994242424242424242999")).toBe(
			"99994242424242424242999",
		);
		// Timestamp en milisegundos: empieza con 1, no es una tarjeta.
		expect(scrubText("1700000000000")).toBe("1700000000000");
	});

	it("filtra claves de proveedores conocidos", () => {
		const text = [
			"AKIAIOSFODNN7EXAMPLE",
			`ghp_${"a".repeat(36)}`,
			`sk_live_${"b".repeat(24)}`,
			"xoxb-1234567890-abcdefghij",
			`snt_${"0".repeat(48)}`,
		].join(" ");
		expect(scrubText(text)).toBe(Array(5).fill(FILTERED).join(" "));
	});

	it("filtra credenciales en URLs y parámetros sensibles, conservando el resto", () => {
		expect(scrubText("postgres://admin:s3cr3t@db.internal:5432/app")).toBe(
			`postgres://admin:${FILTERED}@db.internal:5432/app`,
		);
		expect(
			scrubText("https://app.com/cb?code=1&access_token=abc123&page=2#x"),
		).toBe(`https://app.com/cb?code=1&access_token=${FILTERED}&page=2#x`);
		expect(scrubText("https://app.com/search?q=hello&sort=asc")).toBe(
			"https://app.com/search?q=hello&sort=asc",
		);
	});

	it("filtra password=... y JSON serializado, pero no mensajes normales", () => {
		expect(scrubText("login failed password=hunter2 for ana")).toBe(
			`login failed password=${FILTERED} for ana`,
		);
		expect(scrubText('{"user":"ana","password":"hunter2","ok":true}')).toBe(
			`{"user":"ana","password":"${FILTERED}","ok":true}`,
		);
		expect(scrubText("Invalid token: expired")).toBe("Invalid token: expired");
		expect(scrubText("Cannot read properties of undefined")).toBe(
			"Cannot read properties of undefined",
		);
	});

	it("filtra claves privadas PEM", () => {
		const pem =
			"-----BEGIN RSA PRIVATE KEY-----\nMIIEow\nabc\n-----END RSA PRIVATE KEY-----";
		expect(scrubText(`key: ${pem} fin`)).toBe(`key: ${FILTERED} fin`);
	});
});

describe("scrubEvent", () => {
	const event = {
		event_id: "11111111-1111-4111-8111-111111111111",
		timestamp: "1700000000000",
		level: "error",
		release: "1.0.0",
		message: "Falló el pago con 4242 4242 4242 4242",
		user: { id: "4242424242424242", email: "ana@example.com" },
		tags: { feature: "checkout", api_key: "abc" },
		request: {
			url: "https://shop.dev/cart?token=zzz",
			headers: {
				Authorization: "Bearer abcdefghij",
				Cookie: "sid=1",
				"User-Agent": "Mozilla",
			},
		},
		extra: {
			form: { password: "hunter2", name: "Ana", nested: [{ secret: 1 }] },
		},
		breadcrumbs: [
			{ category: "fetch", data: { url: "https://x.com/?password=a1" } },
		],
		exception: {
			values: [
				{
					type: "Error",
					value: "password=hunter2",
					stacktrace: { frames: [{ lineno: 3 }] },
				},
			],
		},
	};

	it("filtra por clave y por contenido, en cualquier profundidad", () => {
		const out = scrubEvent(event);
		expect(out.message).toBe(`Falló el pago con ${FILTERED}`);
		expect(out.tags).toEqual({ feature: "checkout", api_key: FILTERED });
		expect(out.request).toEqual({
			url: `https://shop.dev/cart?token=${FILTERED}`,
			headers: {
				Authorization: FILTERED,
				Cookie: FILTERED,
				"User-Agent": "Mozilla",
			},
		});
		expect(out.extra).toEqual({
			form: { password: FILTERED, name: "Ana", nested: [{ secret: FILTERED }] },
		});
		expect(out.breadcrumbs[0].data.url).toBe(
			`https://x.com/?password=${FILTERED}`,
		);
		expect(out.exception.values[0].value).toBe(`password=${FILTERED}`);
		expect(out.exception.values[0].stacktrace.frames).toEqual([{ lineno: 3 }]);
	});

	it("no toca los campos de identificación ni el id del usuario", () => {
		const out = scrubEvent(event);
		expect(out.event_id).toBe(event.event_id);
		expect(out.timestamp).toBe(event.timestamp);
		expect(out.release).toBe("1.0.0");
		// 4242424242424242 pasa Luhn, pero como id del usuario es un identificador.
		expect(out.user).toEqual({
			id: "4242424242424242",
			email: "ana@example.com",
		});
	});

	it("no modifica el original", () => {
		const copy = structuredClone(event);
		scrubEvent(event);
		expect(event).toEqual(copy);
	});

	it("una estructura muy profunda se recorta en lugar de agotar la pila", () => {
		let deep: Record<string, unknown> = { leaf: "x" };
		for (let i = 0; i < 100; i++) deep = { next: deep };
		const out = JSON.stringify(scrubEvent({ extra: deep }));
		expect(out).toContain("[Truncated]");
	});

	it("es idempotente", () => {
		const once = scrubEvent(event);
		expect(scrubEvent(once)).toEqual(once);
	});
});
