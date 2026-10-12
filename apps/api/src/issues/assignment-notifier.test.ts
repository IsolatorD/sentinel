import type { ConfigService } from "@nestjs/config";
import { describe, expect, it, vi } from "vitest";
import type { MailQueueService } from "../mail/mail-queue.service.js";
import type { PreferencesRepository } from "../preferences/preferences.repository.js";
import { AssignmentNotifier } from "./assignment-notifier.js";
import type { IssuesRepository } from "./issues.repository.js";

const notice = {
	projectId: "p1",
	issueId: "i1",
	issueTitle: "TypeError: boom",
	assignee: { id: "u2", name: "Beto", email: "beto@acme.test" },
	assigner: { id: "u1", name: "Ana" },
};

function setup(
	prefs: { emailOnAssign: boolean; locale: "en" | "es" | null } = {
		emailOnAssign: true,
		locale: "es",
	},
) {
	const mail = { send: vi.fn(async () => {}) };
	const preferences = { get: vi.fn(async () => prefs) };
	const issues = {
		notificationContext: vi.fn(async () => ({
			projectName: "Storefront",
			projectSlug: "storefront",
			orgSlug: "acme",
		})),
	};
	const config = { get: () => "http://web.test/" };
	const notifier = new AssignmentNotifier(
		mail as unknown as MailQueueService,
		preferences as unknown as PreferencesRepository,
		issues as unknown as IssuesRepository,
		config as unknown as ConfigService<never, true>,
	);
	return { notifier, mail, preferences, issues };
}

describe("AssignmentNotifier", () => {
	it("escribe a quien recibe el issue, en su idioma y con el enlace al issue", async () => {
		const { notifier, mail } = setup();
		await notifier.notify(notice);
		expect(mail.send).toHaveBeenCalledOnce();
		const sent = mail.send.mock.calls[0] as unknown as [
			{ to: string; subject: string; text: string },
		];
		expect(sent[0].to).toBe("beto@acme.test");
		expect(sent[0].subject).toBe("Ana te asignó un issue en Storefront");
		expect(sent[0].text).toContain(
			"http://web.test/acme/projects/storefront/issues/i1",
		);
	});

	it("no escribe a quien se asigna el issue a sí mismo", async () => {
		const { notifier, mail, preferences } = setup();
		await notifier.notify({
			...notice,
			assignee: { id: "u1", name: "Ana", email: "ana@acme.test" },
		});
		expect(mail.send).not.toHaveBeenCalled();
		expect(preferences.get).not.toHaveBeenCalled();
	});

	it("respeta que la persona lo haya desactivado", async () => {
		const { notifier, mail } = setup({ emailOnAssign: false, locale: "en" });
		await notifier.notify(notice);
		expect(mail.send).not.toHaveBeenCalled();
	});

	it("usa el idioma por defecto si la persona no eligió uno", async () => {
		const { notifier, mail } = setup({ emailOnAssign: true, locale: null });
		await notifier.notify(notice);
		expect(mail.send).toHaveBeenCalledOnce();
	});

	it("nunca lanza, aunque falle el correo", async () => {
		const { notifier, mail } = setup();
		mail.send.mockRejectedValueOnce(new Error("redis caído"));
		await expect(notifier.notify(notice)).resolves.toBeUndefined();
	});
});
