import {
	errorResponseSchema,
	eventDetailDtoSchema,
	eventListDtoSchema,
	issueDetailDtoSchema,
	issueListDtoSchema,
} from "@sentinel/shared";
import { describe, expect, it } from "vitest";
import { scalar } from "../support/db.js";
import { eventually } from "../support/eventually.js";
import {
	createTenant,
	errorEvent,
	minutesAgo,
	type Tenant,
} from "../support/factories.js";

const MISSING = "00000000-0000-4000-8000-000000000000";

/**
 * Siembra 5 issues con fechas pasadas conocidas (de más antiguo a más reciente):
 * message (420 min) < SyntaxError (360) < TypeError (300-290, 3 eventos, 2 usuarios)
 * < RangeError (240) < ReferenceError (210).
 */
async function seed(t: Tenant) {
	const send = (e: unknown) => t.client.ingest(t.projectId, t.key, e);
	await send({
		level: "info",
		message: "Checkout done",
		timestamp: minutesAgo(420),
	});
	await send(
		errorEvent({
			type: "SyntaxError",
			value: "bad json",
			fn: "parse",
			user: "u5",
			timestamp: minutesAgo(360),
		}),
	);
	await send(errorEvent({ user: "u1", timestamp: minutesAgo(300) }));
	await send(errorEvent({ user: "u2", timestamp: minutesAgo(295) }));
	await send(errorEvent({ user: "u1", timestamp: minutesAgo(290) }));
	await send(
		errorEvent({
			type: "RangeError",
			value: "out of range",
			fn: "compute",
			user: "u3",
			timestamp: minutesAgo(240),
		}),
	);
	await send(
		errorEvent({
			type: "ReferenceError",
			value: "y is not defined",
			fn: "render",
			user: "u4",
			timestamp: minutesAgo(210),
		}),
	);
	await eventually(async () =>
		expect(
			await scalar("select count(*) from event where project_id = $1", [
				t.projectId,
			]),
		).toBe(7),
	);
	const url = `${t.projectPath}/issues`;
	const list = async (query = "", session = t.owner) =>
		(await t.client.get(`${url}${query}`, session)).json;
	const idOf = async (type: string) =>
		(await list("?status=all")).items.find(
			(i: { type: string }) => i.type === type,
		).id as string;
	return { url, list, idOf };
}

const types = (page: { items: Array<{ type: string }> }) =>
	page.items.map((i) => i.type);

describe("API de issues: listado", () => {
	it("por defecto lista los no resueltos, del más reciente al más antiguo", async () => {
		const t = await createTenant();
		const { list } = await seed(t);
		const page = issueListDtoSchema.parse(await list());
		expect(page).toMatchObject({ total: 5, limit: 25, offset: 0 });
		expect(types(page)).toEqual([
			"ReferenceError",
			"RangeError",
			"TypeError",
			"SyntaxError",
			"message",
		]);
	});

	it("cada issue trae sus contadores: eventos y usuarios distintos afectados", async () => {
		const t = await createTenant();
		const { list } = await seed(t);
		const typeError = (await list()).items.find(
			(i: { type: string }) => i.type === "TypeError",
		);
		expect(typeError).toMatchObject({
			eventCount: 3,
			userCount: 2,
			status: "unresolved",
		});
	});

	it("ordena por eventos, por primera vez visto y en ambos sentidos", async () => {
		const t = await createTenant();
		const { list } = await seed(t);
		expect(types(await list("?sort=events"))[0]).toBe("TypeError");
		expect(types(await list("?order=asc"))[0]).toBe("message");
		expect(types(await list("?sort=firstSeen&order=asc"))).toEqual([
			"message",
			"SyntaxError",
			"TypeError",
			"RangeError",
			"ReferenceError",
		]);
	});

	it("pagina sin repetir ni perder issues y mantiene el total", async () => {
		const t = await createTenant();
		const { list } = await seed(t);
		const q = (offset: number) =>
			`?limit=2&offset=${offset}&sort=firstSeen&order=asc`;
		const pages = [await list(q(0)), await list(q(2)), await list(q(4))];

		expect(pages.map((p) => p.items.length)).toEqual([2, 2, 1]);
		expect(pages.map((p) => p.total)).toEqual([5, 5, 5]);
		const ids = pages.flatMap((p) => p.items.map((i: { id: string }) => i.id));
		expect(new Set(ids).size).toBe(5);
		expect((await list("?offset=50")).items).toEqual([]);
	});

	it("filtra por nivel y busca en título y culprit sin distinguir mayúsculas", async () => {
		const t = await createTenant();
		const { list } = await seed(t);
		expect(types(await list("?level=info"))).toEqual(["message"]);
		expect(types(await list("?q=out%20of%20range"))).toEqual(["RangeError"]);
		expect(types(await list("?q=RENDER"))).toEqual(["ReferenceError"]);
		expect((await list("?q=nada-que-ver")).total).toBe(0);
	});

	it("los comodines de LIKE en la búsqueda se tratan como texto literal", async () => {
		const t = await createTenant();
		const { list } = await seed(t);
		expect((await list("?q=%25")).total).toBe(0);
		expect((await list("?q=_")).total).toBe(0);
		expect((await list("?q=100%25%20_")).total).toBe(0);
	});

	it("valida los parámetros con 400", async () => {
		const t = await createTenant();
		const { url } = await seed(t);
		for (const bad of [
			"limit=0",
			"limit=101",
			"limit=abc",
			"offset=-1",
			"status=borrado",
			"sort=nombre",
			"order=azar",
			"level=critico",
			"q=%20%20",
		]) {
			const res = await t.client.get(`${url}?${bad}`, t.owner);
			expect(res.status, bad).toBe(400);
			expect(errorResponseSchema.parse(res.json).code).toBe(
				"VALIDATION_FAILED",
			);
		}
		expect((await t.client.get(`${url}/no-es-uuid`, t.owner)).status).toBe(400);
	});
});

describe("API de issues: detalle y eventos", () => {
	it("el detalle trae el último evento completo con su stacktrace", async () => {
		const t = await createTenant();
		const { url, idOf } = await seed(t);
		const res = await t.client.get(
			`${url}/${await idOf("TypeError")}`,
			t.owner,
		);
		const detail = issueDetailDtoSchema.parse(res.json);
		expect(detail.userCount).toBe(2);
		expect(detail.latestEvent?.timestamp).toBe(
			minutesAgoApprox(290, detail.latestEvent?.timestamp),
		);
		expect(detail.latestEvent?.payload).toMatchObject({
			exception: { values: [{ type: "TypeError" }] },
		});
	});

	it("lista los eventos del más reciente al más antiguo, sin el payload, con paginación", async () => {
		const t = await createTenant();
		const { url, idOf } = await seed(t);
		const id = await idOf("TypeError");

		const res = await t.client.get(`${url}/${id}/events`, t.owner);
		const page = eventListDtoSchema.parse(res.json);
		expect(page.total).toBe(3);
		const stamps = page.items.map((e) => Date.parse(e.timestamp));
		expect(stamps).toEqual([...stamps].sort((a, b) => b - a));
		expect(page.items[0]).not.toHaveProperty("payload");
		expect(
			(await t.client.get(`${url}/${id}/events?limit=1&offset=2`, t.owner)).json
				.items,
		).toHaveLength(1);
	});

	it("el detalle de un evento incluye el payload; un evento de otro issue da 404", async () => {
		const t = await createTenant();
		const { url, idOf } = await seed(t);
		const typeErr = await idOf("TypeError");
		const range = await idOf("RangeError");
		const eventId = (await t.client.get(`${url}/${typeErr}/events`, t.owner))
			.json.items[0].id;

		const ok = await t.client.get(
			`${url}/${typeErr}/events/${eventId}`,
			t.owner,
		);
		expect(eventDetailDtoSchema.parse(ok.json).payload).toHaveProperty(
			"exception",
		);
		expect(
			(await t.client.get(`${url}/${range}/events/${eventId}`, t.owner)).status,
		).toBe(404);
		expect(
			(await t.client.get(`${url}/${typeErr}/events/${MISSING}`, t.owner))
				.status,
		).toBe(404);
	});

	it("un issue inexistente da 404", async () => {
		const t = await createTenant();
		expect(
			(await t.client.get(`${t.projectPath}/issues/${MISSING}`, t.owner))
				.status,
		).toBe(404);
	});
});

describe("API de issues: estado y borrado", () => {
	it("resolver e ignorar mueven los issues entre los filtros de estado", async () => {
		const t = await createTenant();
		const { url, list, idOf } = await seed(t);
		const typeErr = await idOf("TypeError");
		const range = await idOf("RangeError");

		const bad = await t.client.patch(
			`${url}/${typeErr}`,
			{ status: "borrado" },
			t.owner,
		);
		expect(bad.status).toBe(400);
		expect(
			(await t.client.patch(`${url}/${typeErr}`, {}, t.owner)).status,
		).toBe(400);

		const resolved = await t.client.patch(
			`${url}/${typeErr}`,
			{ status: "resolved" },
			t.owner,
		);
		expect(resolved.json).toMatchObject({
			id: typeErr,
			status: "resolved",
			userCount: 2,
		});
		await t.client.patch(`${url}/${range}`, { status: "ignored" }, t.owner);

		expect((await list()).total).toBe(3);
		expect(types(await list("?status=resolved"))).toEqual(["TypeError"]);
		expect(types(await list("?status=ignored"))).toEqual(["RangeError"]);
		expect((await list("?status=all")).total).toBe(5);
	});

	it("un miembro puede resolver pero no borrar; el owner borra y los eventos se van en cascada", async () => {
		const t = await createTenant();
		const member = await t.client.signUp("member");
		await t.client.addMember(t.owner, t.orgId, member, "member");
		const { url, idOf } = await seed(t);
		const id = await idOf("TypeError");

		expect(
			(await t.client.patch(`${url}/${id}`, { status: "resolved" }, member))
				.json.status,
		).toBe("resolved");
		expect((await t.client.delete(`${url}/${id}`, member)).status).toBe(403);
		expect((await t.client.get(`${url}/${id}`, t.owner)).status).toBe(200);

		expect((await t.client.delete(`${url}/${id}`, t.owner)).status).toBe(204);
		expect((await t.client.get(`${url}/${id}`, t.owner)).status).toBe(404);
		expect((await t.client.delete(`${url}/${id}`, t.owner)).status).toBe(404);
		expect(
			await scalar("select count(*) from event where issue_id = $1", [id]),
		).toBe(0);
		expect(
			await scalar("select count(*) from event where project_id = $1", [
				t.projectId,
			]),
		).toBe(4);
	});
});

describe("API de issues: acceso y aislamiento", () => {
	it("sin sesión da 401", async () => {
		const t = await createTenant();
		expect((await t.client.get(`${t.projectPath}/issues`)).status).toBe(401);
	});

	it("quien es ajeno a la organización recibe 404 en todo, también usando su propia organización", async () => {
		const a = await createTenant();
		const b = await createTenant();
		const { url, idOf } = await seed(a);
		const id = await idOf("TypeError");
		const eventId = (await a.client.get(`${url}/${id}/events`, a.owner)).json
			.items[0].id;

		const viaOwnOrg = `/api/organizations/${b.orgId}/projects/${b.projectId}/issues`;
		const crossOrg = `/api/organizations/${b.orgId}/projects/${a.projectId}/issues`;
		const attempts = await Promise.all([
			a.client.get(url, b.owner),
			a.client.get(`${url}/${id}`, b.owner),
			a.client.get(`${url}/${id}/events`, b.owner),
			a.client.get(`${url}/${id}/events/${eventId}`, b.owner),
			a.client.patch(`${url}/${id}`, { status: "resolved" }, b.owner),
			a.client.delete(`${url}/${id}`, b.owner),
			// Proyecto de A bajo la organización de B:
			a.client.get(crossOrg, b.owner),
			// Issue de A bajo un proyecto de B:
			a.client.get(`${viaOwnOrg}/${id}`, b.owner),
			a.client.patch(`${viaOwnOrg}/${id}`, { status: "resolved" }, b.owner),
			a.client.delete(`${viaOwnOrg}/${id}`, b.owner),
		]);
		for (const res of attempts) expect(res.status).toBe(404);

		expect((await a.client.get(`${url}/${id}`, a.owner)).json.status).toBe(
			"unresolved",
		);
		expect((await a.client.get(viaOwnOrg, b.owner)).json.total).toBe(0);
	});
});

/** El timestamp guardado debe coincidir con el que se envió (con precisión de milisegundos). */
function minutesAgoApprox(
	minutes: number,
	actual: string | undefined,
): string | undefined {
	if (!actual) return undefined;
	const expected = Date.now() - minutes * 60_000;
	// Tolerancia de 2 min: el evento se creó unos segundos después de calcular `minutesAgo`.
	return Math.abs(Date.parse(actual) - expected) < 120_000
		? actual
		: `distinto de hace ${minutes} min: ${actual}`;
}
