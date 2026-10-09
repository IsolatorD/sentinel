import { describe, expect, it } from "vitest";
import { db } from "../support/db.js";
import { eventually } from "../support/eventually.js";
import { createTenant, type Tenant } from "../support/factories.js";
import { mails } from "../support/mailbox.js";

const invite = (t: Tenant, email: string, role = "member", as = t.owner) =>
	t.client.post(
		"/api/auth/organization/invite-member",
		{ email, role, organizationId: t.orgId },
		as,
	);

const mailTo = (email: string) => mails().filter((m) => m.to.includes(email));

const memberEmails = async (t: Tenant) =>
	(
		await db().query(
			'select u.email from member m join "user" u on u.id = m.user_id where m.organization_id = $1',
			[t.orgId],
		)
	).rows.map((r) => r.email as string);

describe("invitaciones por email", () => {
	it("invitar envía un correo con el enlace de aceptación del panel", async () => {
		const t = await createTenant();
		const email = `nuevo-${crypto.randomUUID().slice(0, 8)}@e2e.test`;
		const res = await invite(t, email);
		expect(res.status, res.text).toBe(200);

		await eventually(async () => expect(mailTo(email)).toHaveLength(1));
		const [mail] = mailTo(email);
		expect(mail.subject).toMatch(/^owner invited you to Acme on Sentinel$/);
		expect(mail.text).toContain(
			`http://localhost:5173/accept-invitation/${res.json.id}`,
		);
		expect(mail.html).toContain(`/accept-invitation/${res.json.id}`);
		expect(mail.text).toContain("as member");
		expect(mail.from).toContain("alerts@sentinel.test");
	});

	it("quien recibe la invitación se une al aceptarla, aunque se registre después", async () => {
		const t = await createTenant();
		const email = `tardio-${crypto.randomUUID().slice(0, 8)}@e2e.test`;
		const res = await invite(t, email, "admin");
		await eventually(async () => expect(mailTo(email)).toHaveLength(1));

		// Se registra con ese correo y acepta el enlace del correo.
		const guest = await t.client.signUp("tardio");
		await db().query('update "user" set email = $1 where email = $2', [
			email,
			guest.email,
		]);
		const login = await t.client.post(
			"/api/auth/sign-in/email",
			{ email, password: "Passw0rd-e2e-123" },
			guest,
		);
		expect(login.status).toBe(200);

		const accepted = await t.client.post(
			"/api/auth/organization/accept-invitation",
			{ invitationId: res.json.id },
			guest,
		);
		expect(accepted.status, accepted.text).toBe(200);
		expect(await memberEmails(t)).toContain(email);
		const role = (
			await db().query(
				'select role from member m join "user" u on u.id = m.user_id where u.email = $1 and m.organization_id = $2',
				[email, t.orgId],
			)
		).rows[0].role;
		expect(role).toBe("admin");
	});

	it("otra persona no puede aceptar una invitación que no es suya", async () => {
		const t = await createTenant();
		const email = `ajeno-${crypto.randomUUID().slice(0, 8)}@e2e.test`;
		const res = await invite(t, email);
		const intruder = await t.client.signUp("intruder");
		const attempt = await t.client.post(
			"/api/auth/organization/accept-invitation",
			{ invitationId: res.json.id },
			intruder,
		);
		expect(attempt.status).not.toBe(200);
		expect(await memberEmails(t)).not.toContain(intruder.email);
	});

	it("un miembro corriente no puede invitar", async () => {
		const t = await createTenant();
		const member = await t.client.signUp("member");
		await t.client.addMember(t.owner, t.orgId, member, "member");
		const email = `bloqueado-${crypto.randomUUID().slice(0, 8)}@e2e.test`;
		const res = await invite(t, email, "member", member);
		expect(res.status).toBe(403);
		await new Promise((r) => setTimeout(r, 500));
		expect(mailTo(email)).toHaveLength(0);
	});

	it("reenviar la invitación manda otro correo con el mismo enlace", async () => {
		const t = await createTenant();
		const email = `reenvio-${crypto.randomUUID().slice(0, 8)}@e2e.test`;
		const first = await invite(t, email);
		await eventually(async () => expect(mailTo(email)).toHaveLength(1));
		const again = await t.client.post(
			"/api/auth/organization/invite-member",
			{ email, role: "member", organizationId: t.orgId, resend: true },
			t.owner,
		);
		expect(again.status, again.text).toBe(200);
		await eventually(async () => expect(mailTo(email)).toHaveLength(2));
		expect(mailTo(email)[1].text).toContain(
			`/accept-invitation/${first.json.id}`,
		);
	});

	it("una invitación cancelada ya no se puede aceptar", async () => {
		const t = await createTenant();
		const guest = await t.client.signUp("cancelada");
		const res = await invite(t, guest.email);
		expect(
			(
				await t.client.post(
					"/api/auth/organization/cancel-invitation",
					{ invitationId: res.json.id },
					t.owner,
				)
			).status,
		).toBe(200);
		const attempt = await t.client.post(
			"/api/auth/organization/accept-invitation",
			{ invitationId: res.json.id },
			guest,
		);
		expect(attempt.status).not.toBe(200);
		expect(await memberEmails(t)).not.toContain(guest.email);
	});

	it("la lista de invitaciones pendientes y de miembros la ven los miembros de la organización", async () => {
		const t = await createTenant();
		await invite(t, `pendiente-${crypto.randomUUID().slice(0, 8)}@e2e.test`);
		const invitations = await t.client.get(
			`/api/auth/organization/list-invitations?organizationId=${t.orgId}`,
			t.owner,
		);
		expect(invitations.status).toBe(200);
		expect(
			invitations.json.filter(
				(i: { status: string }) => i.status === "pending",
			),
		).toHaveLength(1);
		const members = await t.client.get(
			`/api/auth/organization/list-members?organizationId=${t.orgId}`,
			t.owner,
		);
		expect(members.json.members).toHaveLength(1);
		expect(members.json.members[0].user.email).toBe(t.owner.email);
	});
});
