import {
	activityDtoSchema,
	activityListDtoSchema,
	issueDetailDtoSchema,
	issueDtoSchema,
	issueListDtoSchema,
} from "@sentinel/shared";
import { describe, expect, it } from "vitest";
import { scalar } from "../support/db.js";
import { eventually } from "../support/eventually.js";
import {
	createTenant,
	errorEvent,
	type Session,
	type Tenant,
} from "../support/factories.js";

async function userId(t: Tenant, session: Session): Promise<string> {
	const res = await t.client.get("/api/auth/get-session", session);
	return res.json.user.id;
}

/** Un tenant con su owner y un miembro corriente, y un issue ya creado por el worker. */
async function setup() {
	const t = await createTenant();
	const member = await t.client.signUp("member");
	await t.client.addMember(t.owner, t.orgId, member, "member");
	const ownerId = await userId(t, t.owner);
	const memberId = await userId(t, member);
	await t.client.ingest(t.projectId, t.key, errorEvent({ type: "BoomError" }));
	await eventually(async () =>
		expect(
			await scalar("select count(*) from issue where project_id = $1", [
				t.projectId,
			]),
		).toBe(1),
	);
	const list = issueListDtoSchema.parse(
		(await t.client.get(`${t.projectPath}/issues?status=all`, t.owner)).json,
	);
	const issue = list.items[0];
	return {
		t,
		member,
		ownerId,
		memberId,
		issue,
		path: `${t.projectPath}/issues/${issue.id}`,
	};
}

describe("asignación", () => {
	it("un issue nuevo no tiene responsable, y se puede asignar y desasignar", async () => {
		const { t, memberId, issue, path } = await setup();
		expect(issue.assignee).toBeNull();

		const assigned = await t.client.patch(
			path,
			{ assigneeId: memberId },
			t.owner,
		);
		expect(assigned.status).toBe(200);
		const dto = issueDtoSchema.parse(assigned.json);
		expect(dto.assignee).toMatchObject({ id: memberId });
		expect(dto.assignee?.name).toBe("member");
		expect(dto.assignee?.email).toMatch(/@e2e\.test$/);
		// El estado no cambió al asignar.
		expect(dto.status).toBe("unresolved");

		const detail = issueDetailDtoSchema.parse(
			(await t.client.get(path, t.owner)).json,
		);
		expect(detail.assignee?.id).toBe(memberId);

		const cleared = await t.client.patch(path, { assigneeId: null }, t.owner);
		expect(issueDtoSchema.parse(cleared.json).assignee).toBeNull();
	});

	it("cualquier miembro puede asignar, también a sí mismo", async () => {
		const { t, member, memberId, path } = await setup();
		const res = await t.client.patch(path, { assigneeId: memberId }, member);
		expect(res.status).toBe(200);
		expect(issueDtoSchema.parse(res.json).assignee?.id).toBe(memberId);
	});

	it("no se puede asignar a quien no es miembro de la organización", async () => {
		const { t, path } = await setup();
		const stranger = await t.client.signUp("stranger");
		const strangerId = await userId(t, stranger);
		const res = await t.client.patch(path, { assigneeId: strangerId }, t.owner);
		expect(res.status).toBe(400);
		expect(res.json.message).toMatch(/not a member/);
		expect(
			(await t.client.patch(path, { assigneeId: "no-existe" }, t.owner)).status,
		).toBe(400);
	});

	it("estado y responsable se pueden cambiar en una sola petición; una petición vacía se rechaza", async () => {
		const { t, memberId, path } = await setup();
		const res = await t.client.patch(
			path,
			{ status: "resolved", assigneeId: memberId },
			t.owner,
		);
		expect(issueDtoSchema.parse(res.json)).toMatchObject({
			status: "resolved",
			assignee: { id: memberId },
		});
		expect((await t.client.patch(path, {}, t.owner)).status).toBe(400);
		expect(
			(await t.client.patch(path, { assigneeId: 123 }, t.owner)).status,
		).toBe(400);
	});

	it("filtra el listado por responsable: yo, sin asignar o una persona", async () => {
		const { t, member, ownerId, memberId, path } = await setup();
		await t.client.ingest(
			t.projectId,
			t.key,
			errorEvent({ type: "SecondError" }),
		);
		await eventually(async () =>
			expect(
				await scalar("select count(*) from issue where project_id = $1", [
					t.projectId,
				]),
			).toBe(2),
		);
		await t.client.patch(path, { assigneeId: memberId }, t.owner);

		const types = async (query: string, as: Session = t.owner) =>
			issueListDtoSchema
				.parse(
					(
						await t.client.get(
							`${t.projectPath}/issues?status=all&${query}`,
							as,
						)
					).json,
				)
				.items.map((i) => i.type)
				.sort();

		expect(await types("assignee=unassigned")).toEqual(["SecondError"]);
		expect(await types(`assignee=${memberId}`)).toEqual(["BoomError"]);
		expect(await types("assignee=me", member)).toEqual(["BoomError"]); // "me" depende de quien consulta
		expect(await types("assignee=me", t.owner)).toEqual([]);
		expect(await types(`assignee=${ownerId}`)).toEqual([]);
		expect(await types("")).toEqual(["BoomError", "SecondError"]);
	});

	it("los ajenos no pueden asignar", async () => {
		const { t, memberId, path } = await setup();
		const outsider = await t.client.signUp("outsider");
		expect(
			(await t.client.patch(path, { assigneeId: memberId }, outsider)).status,
		).toBe(404);
	});

	it("si la persona asignada deja de existir, el issue queda sin asignar", async () => {
		const { t, memberId, path } = await setup();
		await t.client.patch(path, { assigneeId: memberId }, t.owner);
		const { db } = await import("../support/db.js");
		await db().query('delete from "user" where id = $1', [memberId]);
		const detail = issueDetailDtoSchema.parse(
			(await t.client.get(path, t.owner)).json,
		);
		expect(detail.assignee).toBeNull();
	});
});

describe("historial", () => {
	const activity = async (t: Tenant, path: string) =>
		activityListDtoSchema.parse(
			(await t.client.get(`${path}/activity`, t.owner)).json,
		);

	it("registra los cambios de estado y de asignación con quién los hizo, del más reciente al más antiguo", async () => {
		const { t, member, memberId, path } = await setup();
		await t.client.patch(
			path,
			{ status: "resolved", resolution: { type: "release", release: "9.9.9" } },
			t.owner,
		);
		await t.client.patch(path, { assigneeId: memberId }, member);
		await t.client.patch(path, { assigneeId: null }, t.owner);

		const list = await activity(t, path);
		expect(list.total).toBe(3);
		const [unassigned, assigned, status] = list.items;
		expect(unassigned).toMatchObject({
			type: "assignment",
			data: { from: { id: memberId, name: "member" }, to: null },
		});
		expect(unassigned.actor?.name).toBe("owner");
		expect(assigned).toMatchObject({
			type: "assignment",
			data: { from: null, to: { id: memberId, name: "member" } },
		});
		expect(assigned.actor?.name).toBe("member");
		expect(status).toMatchObject({
			type: "status",
			data: {
				from: "unresolved",
				to: "resolved",
				release: "9.9.9",
				inclusive: true,
			},
		});
	});

	it("no anota nada si no cambió nada", async () => {
		const { t, memberId, path } = await setup();
		await t.client.patch(path, { status: "unresolved" }, t.owner);
		await t.client.patch(path, { assigneeId: null }, t.owner);
		expect((await activity(t, path)).total).toBe(0);

		await t.client.patch(path, { assigneeId: memberId }, t.owner);
		await t.client.patch(path, { assigneeId: memberId }, t.owner);
		expect((await activity(t, path)).total).toBe(1);
	});

	it("pagina, y los ajenos no lo ven", async () => {
		const { t, path } = await setup();
		for (let i = 0; i < 3; i++) {
			await t.client.post(
				`${path}/comments`,
				{ body: `comentario ${i}` },
				t.owner,
			);
		}
		const page = activityListDtoSchema.parse(
			(await t.client.get(`${path}/activity?limit=2&offset=1`, t.owner)).json,
		);
		expect(page).toMatchObject({ total: 3, limit: 2, offset: 1 });
		expect(page.items.map((i) => i.body)).toEqual([
			"comentario 1",
			"comentario 0",
		]);

		const outsider = await t.client.signUp("outsider");
		expect((await t.client.get(`${path}/activity`, outsider)).status).toBe(404);
		expect((await t.client.get(`${path}/activity`)).status).toBe(401);
	});

	it("borrar el issue borra su historial", async () => {
		const { t, issue, path } = await setup();
		await t.client.post(`${path}/comments`, { body: "hola" }, t.owner);
		await t.client.delete(path, t.owner);
		expect(
			await scalar("select count(*) from issue_activity where issue_id = $1", [
				issue.id,
			]),
		).toBe(0);
	});
});

describe("comentarios", () => {
	it("cualquier miembro comenta; el comentario trae su autor", async () => {
		const { t, member, path } = await setup();
		const res = await t.client.post(
			`${path}/comments`,
			{ body: "  Lo miro yo  " },
			member,
		);
		expect(res.status).toBe(201);
		const comment = activityDtoSchema.parse(res.json);
		expect(comment).toMatchObject({
			type: "comment",
			body: "Lo miro yo",
			editedAt: null,
			data: null,
		});
		expect(comment.actor).toMatchObject({ name: "member" });
	});

	it("valida el cuerpo: no vacío y de tamaño razonable", async () => {
		const { t, path } = await setup();
		for (const body of ["", "   ", "x".repeat(5001), 123, undefined]) {
			expect(
				(await t.client.post(`${path}/comments`, { body }, t.owner)).status,
				String(body),
			).toBe(400);
		}
		expect(
			(
				await t.client.post(
					`${path}/comments`,
					{ body: "x".repeat(5000) },
					t.owner,
				)
			).status,
		).toBe(201);
	});

	it("solo el autor edita; queda marcado como editado", async () => {
		const { t, member, path } = await setup();
		const created = activityDtoSchema.parse(
			(await t.client.post(`${path}/comments`, { body: "original" }, member))
				.json,
		);
		const url = `${path}/comments/${created.id}`;

		expect((await t.client.patch(url, { body: "ajeno" }, t.owner)).status).toBe(
			403,
		); // ni siquiera un owner
		const edited = activityDtoSchema.parse(
			(await t.client.patch(url, { body: "corregido" }, member)).json,
		);
		expect(edited).toMatchObject({ body: "corregido" });
		expect(edited.editedAt).not.toBeNull();
		expect((await t.client.patch(url, { body: "" }, member)).status).toBe(400);
	});

	it("el autor borra el suyo; un admin borra cualquiera; otro miembro no", async () => {
		const { t, member, path } = await setup();
		const other = await t.client.signUp("other");
		await t.client.addMember(t.owner, t.orgId, other, "member");
		const ofMember = activityDtoSchema.parse(
			(await t.client.post(`${path}/comments`, { body: "a" }, member)).json,
		);
		const ofMember2 = activityDtoSchema.parse(
			(await t.client.post(`${path}/comments`, { body: "b" }, member)).json,
		);

		expect(
			(await t.client.delete(`${path}/comments/${ofMember.id}`, other)).status,
		).toBe(403);
		expect(
			(await t.client.delete(`${path}/comments/${ofMember.id}`, member)).status,
		).toBe(204);
		expect(
			(await t.client.delete(`${path}/comments/${ofMember2.id}`, t.owner))
				.status,
		).toBe(204);
		expect(
			(await t.client.delete(`${path}/comments/${ofMember.id}`, member)).status,
		).toBe(404);
		expect(
			activityListDtoSchema.parse(
				(await t.client.get(`${path}/activity`, t.owner)).json,
			).total,
		).toBe(0);
	});

	it("los cambios del historial no se pueden editar ni borrar como si fueran comentarios", async () => {
		const { t, memberId, path } = await setup();
		await t.client.patch(path, { assigneeId: memberId }, t.owner);
		const entry = activityListDtoSchema.parse(
			(await t.client.get(`${path}/activity`, t.owner)).json,
		).items[0];
		expect(
			(
				await t.client.patch(
					`${path}/comments/${entry.id}`,
					{ body: "x" },
					t.owner,
				)
			).status,
		).toBe(404);
		expect(
			(await t.client.delete(`${path}/comments/${entry.id}`, t.owner)).status,
		).toBe(404);
	});

	it("no se puede comentar un issue de otro proyecto ni de otra organización", async () => {
		const a = await setup();
		const b = await setup();
		expect(
			(await b.t.client.post(`${a.path}/comments`, { body: "x" }, b.t.owner))
				.status,
		).toBe(404);
		// Mismo id de issue pero bajo el proyecto de otro tenant
		const crossPath = `${b.t.projectPath}/issues/${a.issue.id}`;
		expect(
			(await b.t.client.post(`${crossPath}/comments`, { body: "x" }, b.t.owner))
				.status,
		).toBe(404);
	});
});
