import { describe, expect, it } from "vitest";
import { assignmentEmail } from "./assignment-email.js";

const base = {
	assignerName: "Ana",
	projectName: "Storefront",
	issueTitle: "TypeError: x is undefined",
	url: "http://localhost:5173/acme/projects/storefront/issues/1",
};

describe("assignmentEmail", () => {
	it("usa el idioma de quien recibe la asignación", () => {
		expect(assignmentEmail({ ...base, locale: "es" }).subject).toBe(
			"Ana te asignó un issue en Storefront",
		);
		expect(assignmentEmail({ ...base, locale: "en" }).subject).toBe(
			"Ana assigned you an issue in Storefront",
		);
	});

	it("incluye el título y el enlace en texto y HTML", () => {
		const mail = assignmentEmail(base);
		expect(mail.text).toContain(base.issueTitle);
		expect(mail.text).toContain(base.url);
		expect(mail.html).toContain(base.url);
	});

	it("escapa lo que controlan los usuarios en el HTML", () => {
		const mail = assignmentEmail({
			...base,
			assignerName: "<b>Ana</b>",
			issueTitle: '<img src=x onerror="alert(1)">',
		});
		expect(mail.html).not.toContain("<img");
		expect(mail.html).not.toContain("<b>Ana");
		expect(mail.html).toContain("&lt;img");
	});

	it("recorta títulos muy largos", () => {
		const mail = assignmentEmail({ ...base, issueTitle: "x".repeat(500) });
		expect(mail.text).not.toContain("x".repeat(200));
	});
});
