import { issueListDtoSchema, statsDtoSchema } from "@sentinel/shared";
import { describe, expect, it } from "vitest";
import { scalar } from "../support/db.js";
import { eventually } from "../support/eventually.js";
import { createTenant, errorEvent, minutesAgo } from "../support/factories.js";

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe("estadísticas", () => {
	it("serie del proyecto y del issue, continua y con usuarios distintos", async () => {
		const t = await createTenant();
		const send = (e: unknown) => t.client.ingest(t.projectId, t.key, e);
		await send(errorEvent({ user: "u1", timestamp: minutesAgo(30) }));
		await send(errorEvent({ user: "u2", timestamp: minutesAgo(25) }));
		await send(errorEvent({ user: "u1", timestamp: minutesAgo(20) }));
		await send(
			errorEvent({
				type: "RangeError",
				value: "r",
				fn: "other",
				user: "u3",
				timestamp: minutesAgo(10),
			}),
		);
		await eventually(async () =>
			expect(
				await scalar("select count(*) from event where project_id = $1", [
					t.projectId,
				]),
			).toBe(4),
		);

		for (const [period, minutes, count] of [
			["24h", 60, 24],
			["7d", 360, 28],
			["30d", 1440, 30],
		] as const) {
			const res = await t.client.get(
				`${t.projectPath}/stats?period=${period}`,
				t.owner,
			);
			expect(res.status).toBe(200);
			const dto = statsDtoSchema.parse(res.json);
			expect(dto.bucketMinutes).toBe(minutes);
			expect(dto.points).toHaveLength(count);
			expect(dto.totalEvents).toBe(4);
			expect(sum(dto.points.map((p) => p.events))).toBe(4);
		}

		// Sin `period` se usa 24h.
		const def = statsDtoSchema.parse(
			(await t.client.get(`${t.projectPath}/stats`, t.owner)).json,
		);
		expect(def.period).toBe("24h");

		const list = issueListDtoSchema.parse(
			(await t.client.get(`${t.projectPath}/issues`, t.owner)).json,
		);
		expect(list.items).toHaveLength(2);
		const type = list.items.find((i) => i.title.startsWith("TypeError"));
		if (!type) throw new Error("issue no encontrado");
		expect(list.trends[type.id]).toHaveLength(24);
		expect(sum(list.trends[type.id])).toBe(3);

		const one = statsDtoSchema.parse(
			(
				await t.client.get(
					`${t.projectPath}/issues/${type.id}/stats?period=24h`,
					t.owner,
				)
			).json,
		);
		expect(one.totalEvents).toBe(3);
		expect(Math.max(...one.points.map((p) => p.users))).toBeLessThanOrEqual(2);
	});

	it("rechaza un periodo inválido, un issue ajeno y a quien no es miembro", async () => {
		const t = await createTenant();
		const other = await createTenant();
		const bad = await t.client.get(`${t.projectPath}/stats?period=1y`, t.owner);
		expect(bad.status).toBe(400);
		const missing = await t.client.get(
			`${t.projectPath}/issues/00000000-0000-4000-8000-000000000000/stats`,
			t.owner,
		);
		expect(missing.status).toBe(404);
		const foreign = await t.client.get(`${t.projectPath}/stats`, other.owner);
		expect(foreign.status).toBeGreaterThanOrEqual(403);
		expect((await t.client.get(`${t.projectPath}/stats`)).status).toBe(401);
	});
});
