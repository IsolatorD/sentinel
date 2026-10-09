import { describe, expect, it } from "vitest";
import { verificationEmail } from "./verification-email.js";

const base = {
	name: "Ana",
	url: "https://api.example.com/api/auth/verify-email?token=abc&callbackURL=%2F",
};

describe("verificationEmail", () => {
	it("saluda por el nombre e incluye el enlace en texto y en HTML", () => {
		const mail = verificationEmail(base);
		expect(mail.subject).toBe("Verify your email address");
		expect(mail.text).toContain("Hi Ana");
		expect(mail.text).toContain(base.url);
		expect(mail.html).toContain("Verify my email");
		// El & del enlace va escapado dentro del atributo href.
		expect(mail.html).toContain("token=abc&amp;callbackURL=%2F");
	});

	it("sale en el idioma indicado", () => {
		const mail = verificationEmail({ ...base, locale: "es" });
		expect(mail.subject).toBe("Verifica tu correo electrónico");
		expect(mail.text).toContain("Hola Ana");
		expect(mail.text).toContain("Verificar mi correo");
		expect(mail.html).toContain("Confirma tu correo electrónico");
	});

	it("escapa el nombre, que lo escribe quien se registra", () => {
		const mail = verificationEmail({
			...base,
			name: '<img src=x onerror="alert(1)">',
		});
		expect(mail.html).not.toContain("<img");
		expect(mail.html).toContain("&lt;img");
	});

	it("un nombre vacío no deja un saludo roto", () => {
		expect(verificationEmail({ ...base, name: "   " }).text).toMatch(/^Hi \S/);
	});
});
