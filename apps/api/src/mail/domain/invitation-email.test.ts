import { describe, expect, it } from "vitest";
import { invitationEmail } from "./invitation-email.js";

const base = {
	organizationName: "Acme",
	inviterName: "Ana Pérez",
	role: "member",
	url: "https://sentinel.example.com/accept-invitation/abc123",
};

describe("invitationEmail", () => {
	it("dice quién invita, a qué organización y con qué rol, e incluye el enlace", () => {
		const mail = invitationEmail(base);
		expect(mail.subject).toBe("Ana Pérez invited you to Acme on Sentinel");
		for (const part of ["Ana Pérez", "Acme", "as member", base.url]) {
			expect(mail.text).toContain(part);
			expect(mail.html).toContain(part);
		}
	});

	it("sin rol no inventa uno; con varios roles usa el primero", () => {
		expect(invitationEmail({ ...base, role: null }).text).not.toContain(" as ");
		expect(invitationEmail({ ...base, role: "admin, member" }).text).toContain(
			"as admin",
		);
	});

	it("escapa el HTML de los nombres, que los controlan los usuarios", () => {
		const mail = invitationEmail({
			...base,
			organizationName: "<script>alert(1)</script>",
			inviterName: '"><img src=x onerror=alert(1)>',
		});
		expect(mail.html).not.toContain("<script>");
		expect(mail.html).not.toContain("<img");
		expect(mail.html).toContain("&lt;script&gt;");
	});

	it("recorta nombres enormes para que el asunto sea razonable", () => {
		const mail = invitationEmail({
			...base,
			organizationName: "x".repeat(500),
		});
		expect(mail.subject.length).toBeLessThan(200);
	});
});
