import { releaseDtoSchema, releaseListDtoSchema } from "@sentinel/shared";
import { describe, expect, it } from "vitest";
import { scalar } from "../support/db.js";
import { eventually } from "../support/eventually.js";
import { createTenant, errorEvent, type Tenant } from "../support/factories.js";

const issuesOf = async (t: Tenant, query = "?status=all") =>
	(await t.client.get(`${t.projectPath}/issues${query}`, t.owner)).json;
const countEvents = (t: Tenant) =>
	scalar("select count(*) from event where project_id = $1", [t.projectId]);

/** Envía un evento y espera a que el worker lo procese. */
async function send(
	t: Tenant,
	event: ReturnType<typeof errorEvent>,
	expectedTotal: number,
) {
	await t.client.ingest(t.projectId, t.key, event);
	await eventually(async () =>
		expect(await countEvents(t)).toBe(expectedTotal),
	);
}

const issueByType = async (t: Tenant, type: string) =>
	(await issuesOf(t)).items.find((i: { type: string }) => i.type === type);

describe("releases", () => {
	it("se registran solas al llegar el primer evento, con sus contadores", async () => {
		const t = await createTenant();
		await send(t, errorEvent({ type: "A", release: "1.0.0" }), 1);
		await send(t, errorEvent({ type: "A", release: "1.1.0" }), 2);
		await send(t, errorEvent({ type: "B", release: "1.1.0" }), 3);

		const res = await t.client.get(`${t.projectPath}/releases`, t.owner);
		expect(res.status).toBe(200);
		const releases = releaseListDtoSchema.parse(res.json);
		const byVersion = Object.fromEntries(releases.map((r) => [r.version, r]));
		expect(Object.keys(byVersion).sort()).toEqual(["1.0.0", "1.1.0"]);
		expect(byVersion["1.0.0"]).toMatchObject({
			eventCount: 1,
			newIssueCount: 1,
			artifactCount: 0,
		});
		// En 1.1.0: dos eventos, y solo B es un issue nuevo (A ya existía desde 1.0.0).
		expect(byVersion["1.1.0"]).toMatchObject({
			eventCount: 2,
			newIssueCount: 1,
		});
		expect(byVersion["1.1.0"].firstEventAt).not.toBeNull();
	});

	it("el detalle de una release y los eventos sin release no crean ninguna", async () => {
		const t = await createTenant();
		await t.client.ingest(t.projectId, t.key, {
			level: "info",
			message: "sin release",
		});
		await send(t, errorEvent({ release: "2.0.0-rc.1" }), 2);

		const one = await t.client.get(
			`${t.projectPath}/releases/2.0.0-rc.1`,
			t.owner,
		);
		expect(releaseDtoSchema.parse(one.json).version).toBe("2.0.0-rc.1");
		expect(
			(await t.client.get(`${t.projectPath}/releases`, t.owner)).json,
		).toHaveLength(1);
		expect(
			(await t.client.get(`${t.projectPath}/releases/no-existe`, t.owner))
				.status,
		).toBe(404);
	});

	it("cada issue sabe en qué release apareció y en cuál la vez más reciente", async () => {
		const t = await createTenant();
		await send(t, errorEvent({ release: "1.0.0" }), 1);
		await send(t, errorEvent({ release: "1.2.0" }), 2);
		const [issue] = (await issuesOf(t)).items;
		expect(issue).toMatchObject({
			firstRelease: "1.0.0",
			lastRelease: "1.2.0",
		});
	});

	it("lista los entornos y filtra los issues por entorno y por release", async () => {
		const t = await createTenant();
		await send(
			t,
			errorEvent({
				type: "OnlyProd",
				release: "1.0.0",
				environment: "production",
			}),
			1,
		);
		await send(
			t,
			errorEvent({
				type: "OnlyStaging",
				release: "1.1.0",
				environment: "staging",
			}),
			2,
		);
		await send(
			t,
			errorEvent({ type: "Both", release: "1.0.0", environment: "production" }),
			3,
		);
		await send(
			t,
			errorEvent({ type: "Both", release: "1.1.0", environment: "staging" }),
			4,
		);

		expect(
			(await t.client.get(`${t.projectPath}/environments`, t.owner)).json,
		).toEqual(["production", "staging"]);

		const types = async (q: string) =>
			(await issuesOf(t, `?status=all&${q}`)).items
				.map((i: { type: string }) => i.type)
				.sort();
		expect(await types("environment=production")).toEqual(["Both", "OnlyProd"]);
		expect(await types("environment=staging")).toEqual(["Both", "OnlyStaging"]);
		expect(await types("release=1.1.0")).toEqual(["Both", "OnlyStaging"]);
		expect(await types("environment=production&release=1.1.0")).toEqual([]);
		expect(await types("environment=nada")).toEqual([]);
	});

	it("solo un admin puede borrar una release; los ajenos reciben 404", async () => {
		const t = await createTenant();
		await send(t, errorEvent({ release: "1.0.0" }), 1);
		const member = await t.client.signUp("member");
		await t.client.addMember(t.owner, t.orgId, member, "member");
		const outsider = await t.client.signUp("outsider");

		expect(
			(await t.client.get(`${t.projectPath}/releases`, member)).status,
		).toBe(200);
		expect(
			(await t.client.delete(`${t.projectPath}/releases/1.0.0`, member)).status,
		).toBe(403);
		expect(
			(await t.client.get(`${t.projectPath}/releases`, outsider)).status,
		).toBe(404);
		expect(
			(await t.client.get(`${t.projectPath}/environments`, outsider)).status,
		).toBe(404);

		expect(
			(await t.client.delete(`${t.projectPath}/releases/1.0.0`, t.owner))
				.status,
		).toBe(204);
		expect(
			(await t.client.get(`${t.projectPath}/releases/1.0.0`, t.owner)).status,
		).toBe(404);
		// Los eventos que la mencionan se conservan.
		expect(await countEvents(t)).toBe(1);
	});
});

describe("regresiones por release", () => {
	const resolve = async (t: Tenant, id: string, body: unknown) =>
		(await t.client.patch(`${t.projectPath}/issues/${id}`, body, t.owner)).json;

	it("resuelto en la próxima release: los eventos de versiones viejas NO lo reabren, uno de una posterior sí", async () => {
		const t = await createTenant();
		await send(t, errorEvent({ release: "2.4.0" }), 1);
		const issue = await issueByType(t, "TypeError");

		const resolved = await resolve(t, issue.id, {
			status: "resolved",
			resolution: { type: "next_release" },
		});
		expect(resolved).toMatchObject({
			status: "resolved",
			resolvedRelease: "2.4.0",
			resolvedInclusive: false,
		});

		// Clientes que siguen con la versión vieja o la misma: el issue sigue resuelto, pero cuenta el evento.
		await send(t, errorEvent({ release: "2.3.0" }), 2);
		await send(t, errorEvent({ release: "2.4.0" }), 3);
		expect(await issueByType(t, "TypeError")).toMatchObject({
			status: "resolved",
			eventCount: 3,
			regressedAt: null,
		});

		// Una release posterior: es una regresión.
		await send(t, errorEvent({ release: "2.5.0" }), 4);
		const after = await issueByType(t, "TypeError");
		expect(after).toMatchObject({
			status: "unresolved",
			regressedInRelease: "2.5.0",
			resolvedRelease: null,
			lastRelease: "2.5.0",
		});
		expect(after.regressedAt).not.toBeNull();
	});

	it("resuelto en una release concreta: esa misma release ya cuenta como regresión", async () => {
		const t = await createTenant();
		await send(t, errorEvent({ release: "2.4.0" }), 1);
		const issue = await issueByType(t, "TypeError");
		await resolve(t, issue.id, {
			status: "resolved",
			resolution: { type: "release", release: "2.5.0" },
		});

		await send(t, errorEvent({ release: "2.4.9" }), 2);
		expect((await issueByType(t, "TypeError")).status).toBe("resolved");

		await send(t, errorEvent({ release: "2.5.0" }), 3);
		expect(await issueByType(t, "TypeError")).toMatchObject({
			status: "unresolved",
			regressedInRelease: "2.5.0",
		});
	});

	it("resuelto sin release: cualquier evento nuevo lo reabre como regresión", async () => {
		const t = await createTenant();
		await send(t, errorEvent({ release: "2.4.0" }), 1);
		const issue = await issueByType(t, "TypeError");
		await resolve(t, issue.id, { status: "resolved" });

		await send(t, errorEvent({ release: "1.0.0" }), 2);
		expect(await issueByType(t, "TypeError")).toMatchObject({
			status: "unresolved",
			regressedInRelease: "1.0.0",
		});
	});

	it("un evento sin release no se puede comparar: ante la duda se reabre", async () => {
		const t = await createTenant();
		await send(t, errorEvent({ release: "2.4.0" }), 1);
		const issue = await issueByType(t, "TypeError");
		await resolve(t, issue.id, {
			status: "resolved",
			resolution: { type: "next_release" },
		});

		const noRelease = errorEvent();
		(noRelease as { release?: string }).release = undefined;
		await send(t, noRelease, 2);
		expect((await issueByType(t, "TypeError")).status).toBe("unresolved");
	});

	it("las versiones que no son semver se ordenan por la fecha en que se vieron", async () => {
		const t = await createTenant();
		await send(t, errorEvent({ release: "abc1234" }), 1);
		await new Promise((r) => setTimeout(r, 50));
		await send(t, errorEvent({ type: "Other", release: "def5678" }), 2);
		const issue = await issueByType(t, "TypeError");
		await resolve(t, issue.id, {
			status: "resolved",
			resolution: { type: "next_release" },
		});

		// La baseline es la última release creada (def5678); una anterior no reabre.
		await send(t, errorEvent({ release: "abc1234" }), 3);
		expect((await issueByType(t, "TypeError")).status).toBe("resolved");
		// Una más nueva (creada después) sí.
		await new Promise((r) => setTimeout(r, 50));
		await send(t, errorEvent({ release: "fff9999" }), 4);
		expect((await issueByType(t, "TypeError")).status).toBe("unresolved");
	});

	it("un issue ignorado sigue ignorado aunque llegue una release nueva", async () => {
		const t = await createTenant();
		await send(t, errorEvent({ release: "2.4.0" }), 1);
		const issue = await issueByType(t, "TypeError");
		await resolve(t, issue.id, { status: "ignored" });
		await send(t, errorEvent({ release: "3.0.0" }), 2);
		expect(await issueByType(t, "TypeError")).toMatchObject({
			status: "ignored",
			regressedAt: null,
		});
	});

	it("cambiar el estado a mano limpia la marca de regresión", async () => {
		const t = await createTenant();
		await send(t, errorEvent({ release: "2.4.0" }), 1);
		const issue = await issueByType(t, "TypeError");
		await resolve(t, issue.id, { status: "resolved" });
		await send(t, errorEvent({ release: "2.5.0" }), 2);
		expect((await issueByType(t, "TypeError")).regressedAt).not.toBeNull();

		await resolve(t, issue.id, { status: "unresolved" });
		expect(await issueByType(t, "TypeError")).toMatchObject({
			regressedAt: null,
			regressedInRelease: null,
		});
	});

	it("una resolución solo tiene sentido al resolver: se valida", async () => {
		const t = await createTenant();
		await send(t, errorEvent({ release: "2.4.0" }), 1);
		const issue = await issueByType(t, "TypeError");
		const url = `${t.projectPath}/issues/${issue.id}`;
		expect(
			(
				await t.client.patch(
					url,
					{ status: "ignored", resolution: { type: "next_release" } },
					t.owner,
				)
			).status,
		).toBe(400);
		expect(
			(
				await t.client.patch(
					url,
					{ status: "resolved", resolution: { type: "otra" } },
					t.owner,
				)
			).status,
		).toBe(400);
		expect(
			(
				await t.client.patch(
					url,
					{ status: "resolved", resolution: { type: "release" } },
					t.owner,
				)
			).status,
		).toBe(400);
	});

	it("los eventos duplicados no cuentan dos veces ni provocan regresiones falsas", async () => {
		const t = await createTenant();
		const eventId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
		await send(t, errorEvent({ release: "2.4.0", eventId }), 1);
		const issue = await issueByType(t, "TypeError");
		await resolve(t, issue.id, {
			status: "resolved",
			resolution: { type: "next_release" },
		});

		// Mismo evento reenviado: no se cuenta y el issue sigue resuelto.
		await t.client.ingest(
			t.projectId,
			t.key,
			errorEvent({ release: "2.4.0", eventId }),
		);
		await new Promise((r) => setTimeout(r, 800));
		expect(await issueByType(t, "TypeError")).toMatchObject({
			status: "resolved",
			eventCount: 1,
		});
	});
});
