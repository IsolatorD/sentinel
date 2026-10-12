import { describe, expect, it, vi } from "vitest";
import type { RuleRecord } from "../alerts/alerts.repository.js";
import type { AlertsService } from "../alerts/alerts.service.js";
import type { Measurement } from "./performance-alerts.domain.js";
import {
	type MeasureQuery,
	PerformanceAlertsRepository,
} from "./performance-alerts.repository.js";
import { PerformanceAlertsService } from "./performance-alerts.service.js";

const NOW = new Date("2026-10-10T12:00:00.000Z");

const rule = (over: Partial<RuleRecord> = {}): RuleRecord => ({
	id: "r1",
	projectId: "p1",
	name: "Slow checkout",
	trigger: "p95_above",
	threshold: 800,
	windowMinutes: 15,
	cooldownMinutes: 60,
	environment: null,
	minLevel: null,
	transactionName: null,
	channelIds: ["c1"],
	...over,
});

class FakeRepository extends PerformanceAlertsRepository {
	queries: MeasureQuery[] = [];
	constructor(
		private readonly ruleList: RuleRecord[],
		private readonly measurements: (q: MeasureQuery) => Measurement | Error,
	) {
		super();
	}
	async rules() {
		return this.ruleList;
	}
	async measure(q: MeasureQuery) {
		this.queries.push(q);
		const m = this.measurements(q);
		if (m instanceof Error) throw m;
		return m;
	}
}

function setup(
	rules: RuleRecord[],
	measurements: (q: MeasureQuery) => Measurement | Error,
	queued = true,
) {
	const repository = new FakeRepository(rules, measurements);
	const alerts = { onPerformanceBreach: vi.fn(async () => queued) };
	const service = new PerformanceAlertsService(
		repository,
		alerts as unknown as AlertsService,
	);
	return { service, repository, alerts };
}

const slow: Measurement = { sampleCount: 50, p95: 1500, errors: 0 };
const fast: Measurement = { sampleCount: 50, p95: 200, errors: 0 };

describe("PerformanceAlertsService.run", () => {
	it("avisa de las reglas cuya medida cruzó el umbral, con el valor medido", async () => {
		const { service, alerts } = setup([rule()], () => slow);
		expect(await service.run(NOW)).toBe(1);
		expect(alerts.onPerformanceBreach).toHaveBeenCalledWith(
			expect.objectContaining({
				value: 1500,
				sampleCount: 50,
				rule: expect.objectContaining({ id: "r1" }),
			}),
		);
	});

	it("no avisa si la medida está dentro del umbral o hay pocas muestras", async () => {
		const ok = setup([rule()], () => fast);
		expect(await ok.service.run(NOW)).toBe(0);
		const few = setup([rule()], () => ({
			sampleCount: 3,
			p95: 9_999,
			errors: 0,
		}));
		expect(await few.service.run(NOW)).toBe(0);
		expect(few.alerts.onPerformanceBreach).not.toHaveBeenCalled();
	});

	it("mide la ventana de la regla con su entorno y su transacción", async () => {
		const { service, repository } = setup(
			[
				rule({
					windowMinutes: 30,
					environment: "production",
					transactionName: "/checkout",
				}),
			],
			() => fast,
		);
		await service.run(NOW);
		expect(repository.queries).toEqual([
			{
				projectId: "p1",
				since: new Date("2026-10-10T11:30:00.000Z"),
				environment: "production",
				transactionName: "/checkout",
			},
		]);
	});

	it("evalúa la tasa de errores en porcentaje", async () => {
		const { service, alerts } = setup(
			[rule({ trigger: "error_rate_above", threshold: 5 })],
			() => ({ sampleCount: 100, p95: 100, errors: 8 }),
		);
		expect(await service.run(NOW)).toBe(1);
		expect(alerts.onPerformanceBreach).toHaveBeenCalledWith(
			expect.objectContaining({ value: 8 }),
		);
	});

	it("cuenta solo los avisos que realmente se encolaron (la espera puede frenarlos)", async () => {
		const { service } = setup([rule()], () => slow, false);
		expect(await service.run(NOW)).toBe(0);
	});

	it("una regla que falla no impide evaluar las demás", async () => {
		const { service, alerts } = setup(
			[rule({ id: "bad", projectId: "broken" }), rule({ id: "good" })],
			(q) => (q.projectId === "broken" ? new Error("timeout") : slow),
		);
		expect(await service.run(NOW)).toBe(1);
		expect(alerts.onPerformanceBreach).toHaveBeenCalledWith(
			expect.objectContaining({
				rule: expect.objectContaining({ id: "good" }),
			}),
		);
	});

	it("ignora reglas incompletas o que no son de rendimiento", async () => {
		const { service, repository } = setup(
			[
				rule({ id: "a", trigger: "new_issue" }),
				rule({ id: "b", threshold: null }),
				rule({ id: "c", windowMinutes: null }),
			],
			() => slow,
		);
		expect(await service.run(NOW)).toBe(0);
		expect(repository.queries).toHaveLength(0);
	});
});
