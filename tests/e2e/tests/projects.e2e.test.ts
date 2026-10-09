import { projectDtoSchema, projectKeyDtoSchema } from "@sentinel/shared";
import { describe, expect, it } from "vitest";
import { scalar } from "../support/db.js";
import { api, createTenant } from "../support/factories.js";

const MISSING = "00000000-0000-4000-8000-000000000000";

describe("proyectos y claves DSN", () => {
	it("crear un proyecto devuelve su primera clave y una DSN utilizable", async () => {
		const t = await createTenant();
		const res = await t.client.post(
			`/api/organizations/${t.orgId}/projects`,
			{ name: "Mi App Web", platform: "react" },
			t.owner,
		);
		expect(res.status).toBe(201);

		const project = projectDtoSchema.parse(res.json);
		expect(project).toMatchObject({
			name: "Mi App Web",
			slug: "mi-app-web",
			platform: "react",
		});
		expect(project.keys).toHaveLength(1);
		expect(project.keys?.[0].dsn).toBe(
			`${t.client.baseUrl.replace("http://", `http://${project.keys?.[0].publicKey}@`)}/${project.id}`,
		);
	});

	it("dos proyectos con el mismo nombre reciben slugs distintos", async () => {
		const t = await createTenant();
		const again = await t.client.post(
			`/api/organizations/${t.orgId}/projects`,
			{ name: "App" },
			t.owner,
		);
		expect(again.json.slug).toMatch(/^app-[0-9a-f]{4}$/);
	});

	it("listar, ver el detalle con claves, renombrar y cambiar la plataforma", async () => {
		const t = await createTenant();
		await t.client.post(
			`/api/organizations/${t.orgId}/projects`,
			{ name: "Otro" },
			t.owner,
		);

		const list = await t.client.get(
			`/api/organizations/${t.orgId}/projects`,
			t.owner,
		);
		expect(list.json).toHaveLength(2);

		const detail = await t.client.get(t.projectPath, t.owner);
		expect(projectDtoSchema.parse(detail.json).keys).toHaveLength(1);

		const renamed = await t.client.patch(
			t.projectPath,
			{ name: "Renombrada", platform: "node" },
			t.owner,
		);
		expect(renamed.json).toMatchObject({
			name: "Renombrada",
			platform: "node",
		});
	});

	it("valida los datos de entrada con errores 400 detallados", async () => {
		const t = await createTenant();
		const base = `/api/organizations/${t.orgId}/projects`;

		const empty = await t.client.post(base, { name: "   " }, t.owner);
		expect(empty.status).toBe(400);
		expect(empty.json).toMatchObject({ code: "VALIDATION_FAILED" });
		expect(empty.json.issues[0].path).toBe("name");

		expect(
			(await t.client.post(base, { name: "x", platform: "cobol" }, t.owner))
				.status,
		).toBe(400);
		expect((await t.client.patch(t.projectPath, {}, t.owner)).status).toBe(400);
		expect((await t.client.get(`${base}/no-es-uuid`, t.owner)).status).toBe(
			400,
		);
	});

	it("gestiona las claves: crear, revocar, renombrar y borrar", async () => {
		const t = await createTenant();
		const created = await t.client.post(
			`${t.projectPath}/keys`,
			{ label: "Producción" },
			t.owner,
		);
		expect(created.status).toBe(201);
		const key = projectKeyDtoSchema.parse(created.json);
		expect(key).toMatchObject({ label: "Producción", isActive: true });

		const revoked = await t.client.patch(
			`${t.projectPath}/keys/${key.id}`,
			{ isActive: false },
			t.owner,
		);
		expect(revoked.json.isActive).toBe(false);
		expect(
			(await t.client.patch(`${t.projectPath}/keys/${key.id}`, {}, t.owner))
				.status,
		).toBe(400);

		const detail = await t.client.get(t.projectPath, t.owner);
		expect(detail.json.keys).toHaveLength(2);

		expect(
			(await t.client.delete(`${t.projectPath}/keys/${key.id}`, t.owner))
				.status,
		).toBe(204);
		expect(
			(await t.client.delete(`${t.projectPath}/keys/${key.id}`, t.owner))
				.status,
		).toBe(404);
	});

	it("borrar un proyecto elimina en cascada sus claves, issues y eventos", async () => {
		const t = await createTenant();
		await t.client.ingest(t.projectId, t.key, {
			level: "info",
			message: "hola",
		});
		await expectEventually(async () =>
			expect(
				await scalar("select count(*) from event where project_id = $1", [
					t.projectId,
				]),
			).toBe(1),
		);

		expect((await t.client.delete(t.projectPath, t.owner)).status).toBe(204);
		expect((await t.client.get(t.projectPath, t.owner)).status).toBe(404);
		for (const table of ["project_key", "issue", "event"]) {
			expect(
				await scalar(`select count(*) from ${table} where project_id = $1`, [
					t.projectId,
				]),
				table,
			).toBe(0);
		}
	});

	it("sin sesión todo da 401", async () => {
		const t = await createTenant();
		expect(
			(await t.client.get(`/api/organizations/${t.orgId}/projects`)).status,
		).toBe(401);
		expect(
			(
				await t.client.post(`/api/organizations/${t.orgId}/projects`, {
					name: "x",
				})
			).status,
		).toBe(401);
	});
});

describe("permisos por rol", () => {
	it("un miembro puede leer pero no crear, editar ni borrar", async () => {
		const t = await createTenant();
		const member = await t.client.signUp("member");
		await t.client.addMember(t.owner, t.orgId, member, "member");
		const base = `/api/organizations/${t.orgId}/projects`;

		expect((await t.client.get(base, member)).status).toBe(200);
		expect((await t.client.get(t.projectPath, member)).status).toBe(200);
		expect((await t.client.post(base, { name: "x" }, member)).status).toBe(403);
		expect(
			(await t.client.patch(t.projectPath, { name: "x" }, member)).status,
		).toBe(403);
		expect(
			(await t.client.post(`${t.projectPath}/keys`, {}, member)).status,
		).toBe(403);
		expect(
			(
				await t.client.patch(
					`${t.projectPath}/keys/${t.keyId}`,
					{ isActive: false },
					member,
				)
			).status,
		).toBe(403);
		expect(
			(await t.client.delete(`${t.projectPath}/keys/${t.keyId}`, member))
				.status,
		).toBe(403);
		expect((await t.client.delete(t.projectPath, member)).status).toBe(403);

		// Nada cambió.
		const detail = await t.client.get(t.projectPath, t.owner);
		expect(detail.json.keys[0].isActive).toBe(true);
	});

	it("un admin sí puede gestionar proyectos", async () => {
		const t = await createTenant();
		const admin = await t.client.signUp("admin");
		await t.client.addMember(t.owner, t.orgId, admin, "admin");
		const res = await t.client.post(
			`/api/organizations/${t.orgId}/projects`,
			{ name: "Del admin" },
			admin,
		);
		expect(res.status).toBe(201);
		expect(
			(
				await t.client.delete(
					`/api/organizations/${t.orgId}/projects/${res.json.id}`,
					admin,
				)
			).status,
		).toBe(204);
	});
});

describe("aislamiento entre organizaciones", () => {
	it("quien no pertenece a la organización recibe 404 en todo, sin revelar que existe", async () => {
		const a = await createTenant();
		const outsider = await api().signUp("outsider");
		const outsiderOrg = await a.client.createOrganization(outsider, "Otra");
		const base = `/api/organizations/${a.orgId}/projects`;

		const attempts = [
			a.client.get(base, outsider),
			a.client.post(base, { name: "hack" }, outsider),
			a.client.get(a.projectPath, outsider),
			a.client.patch(a.projectPath, { name: "hack" }, outsider),
			a.client.delete(a.projectPath, outsider),
			a.client.post(`${a.projectPath}/keys`, {}, outsider),
			a.client.delete(`${a.projectPath}/keys/${a.keyId}`, outsider),
		];
		for (const res of await Promise.all(attempts)) expect(res.status).toBe(404);

		// Tampoco sirve usar su propia organización con un proyecto ajeno.
		const viaOwnOrg = `/api/organizations/${outsiderOrg}/projects/${a.projectId}`;
		expect((await a.client.get(viaOwnOrg, outsider)).status).toBe(404);
		expect(
			(await a.client.patch(viaOwnOrg, { name: "hack" }, outsider)).status,
		).toBe(404);
		expect((await a.client.delete(viaOwnOrg, outsider)).status).toBe(404);
		expect(
			(await a.client.post(`${viaOwnOrg}/keys`, {}, outsider)).status,
		).toBe(404);

		// El proyecto sigue intacto.
		const intact = await a.client.get(a.projectPath, a.owner);
		expect(intact.json).toMatchObject({ id: a.projectId, name: "App" });
		expect(intact.json.keys).toHaveLength(1);
		expect(
			(
				await a.client.get(
					`/api/organizations/${outsiderOrg}/projects`,
					outsider,
				)
			).json,
		).toEqual([]);
	});

	it("un proyecto inexistente da 404", async () => {
		const t = await createTenant();
		expect(
			(
				await t.client.get(
					`/api/organizations/${t.orgId}/projects/${MISSING}`,
					t.owner,
				)
			).status,
		).toBe(404);
	});
});

async function expectEventually(fn: () => Promise<void>) {
	const { eventually } = await import("../support/eventually.js");
	await eventually(fn);
}
