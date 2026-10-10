import { describe, expect, it } from "vitest";
import { retentionCutoff } from "./retention.domain.js";
import type {
	RetentionProject,
	RetentionRepository,
} from "./retention.repository.js";
import { RetentionService } from "./retention.service.js";

const NOW = new Date("2026-10-10T12:00:00Z");

describe("retentionCutoff", () => {
	it("resta los días a la fecha actual", () => {
		expect(retentionCutoff(NOW, 30).toISOString()).toBe(
			"2026-09-10T12:00:00.000Z",
		);
		expect(retentionCutoff(NOW, 365).toISOString()).toBe(
			"2025-10-10T12:00:00.000Z",
		);
	});
});

function fake(
	projects: RetentionProject[],
	perCall: Record<string, number[]> = {},
) {
	const calls: Array<{
		kind: string;
		projectId: string;
		cutoff: string;
		limit: number;
	}> = [];
	const take = (kind: string) => (perCall[kind] ?? []).shift() ?? 0;
	const repo: RetentionRepository = {
		projects: async () => projects,
		deleteStaleIssues: async (projectId, cutoff, limit) => {
			calls.push({
				kind: "issues",
				projectId,
				cutoff: cutoff.toISOString(),
				limit,
			});
			return take("issues");
		},
		deleteOldEvents: async (projectId, cutoff, limit) => {
			calls.push({
				kind: "events",
				projectId,
				cutoff: cutoff.toISOString(),
				limit,
			});
			return take("events");
		},
		deleteOldTransactions: async (projectId, cutoff, limit) => {
			calls.push({
				kind: "transactions",
				projectId,
				cutoff: cutoff.toISOString(),
				limit,
			});
			return take("transactions");
		},
	};
	return { service: new RetentionService(repo), calls };
}

describe("RetentionService", () => {
	it("usa la retención de cada proyecto para calcular su corte", async () => {
		const { service, calls } = fake([
			{ id: "a", retentionDays: 30 },
			{ id: "b", retentionDays: 365 },
		]);
		await service.run(NOW);
		const cutoffs = Object.fromEntries(
			calls.map((c) => [c.projectId, c.cutoff]),
		);
		expect(cutoffs).toEqual({
			a: "2026-09-10T12:00:00.000Z",
			b: "2025-10-10T12:00:00.000Z",
		});
	});

	it("borra por lotes hasta que un lote sale incompleto y suma lo borrado", async () => {
		const { service, calls } = fake([{ id: "a", retentionDays: 90 }], {
			events: [2_000, 2_000, 150],
			transactions: [10],
			issues: [3],
		});
		const stats = await service.run(NOW);
		expect(stats).toEqual({
			projects: 1,
			issues: 3,
			events: 4_150,
			transactions: 10,
		});
		expect(calls.filter((c) => c.kind === "events")).toHaveLength(3);
		expect(calls.every((c) => c.limit === 2_000)).toBe(true);
	});

	it("primero los issues viejos y después los eventos sueltos", async () => {
		const { service, calls } = fake([{ id: "a", retentionDays: 90 }]);
		await service.run(NOW);
		expect(calls.map((c) => c.kind)).toEqual([
			"issues",
			"events",
			"transactions",
		]);
	});

	it("un proyecto que falla no impide el resto", async () => {
		let n = 0;
		const repo: RetentionRepository = {
			projects: async () => [
				{ id: "bad", retentionDays: 90 },
				{ id: "good", retentionDays: 90 },
			],
			deleteStaleIssues: async (id) => {
				if (id === "bad") throw new Error("boom");
				return 0;
			},
			deleteOldEvents: async () => {
				n++;
				return 0;
			},
			deleteOldTransactions: async () => 0,
		};
		const stats = await new RetentionService(repo).run(NOW);
		expect(stats.projects).toBe(1);
		expect(n).toBe(1);
	});

	it("sin proyectos no hace nada", async () => {
		const { service, calls } = fake([]);
		expect(await service.run(NOW)).toEqual({
			projects: 0,
			issues: 0,
			events: 0,
			transactions: 0,
		});
		expect(calls).toEqual([]);
	});
});
