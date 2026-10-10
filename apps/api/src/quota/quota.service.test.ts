import type { Redis } from "ioredis";
import { describe, expect, it, vi } from "vitest";
import type { QuotaRepository } from "./quota.repository.js";
import { QuotaService } from "./quota.service.js";

const NOW = new Date("2026-10-09T12:00:00Z");
const PROJECT = "11111111-1111-4111-8111-111111111111";

/** Un Redis de mentira con lo que usa el servicio: get, set NX, exists e incr. */
function fakeRedis() {
	const store = new Map<string, number>();
	return {
		store,
		redis: {
			get: async (k: string) => (store.has(k) ? String(store.get(k)) : null),
			exists: async (k: string) => (store.has(k) ? 1 : 0),
			incr: async (k: string) => {
				store.set(k, (store.get(k) ?? 0) + 1);
				return store.get(k);
			},
			set: async (
				k: string,
				v: number,
				_ex: string,
				_ttl: number,
				nx: string,
			) => {
				if (nx === "NX" && store.has(k)) return null;
				store.set(k, Number(v));
				return "OK";
			},
		} as unknown as Redis,
	};
}

function setup(
	limits: { events: number | null; transactions: number | null },
	saved = { events: 0, transactions: 0 },
) {
	const { redis, store } = fakeRedis();
	const repository = {
		limits: vi.fn(async () => limits),
		countSince: vi.fn(
			async (_p: string, kind: "events" | "transactions") => saved[kind],
		),
		projectInOrg: vi.fn(async () => true),
	} as unknown as QuotaRepository;
	return { service: new QuotaService(repository, redis), repository, store };
}

describe("QuotaService", () => {
	it("sin límite deja pasar siempre y no consulta ni cuenta", async () => {
		const { service } = setup({ events: null, transactions: null });
		for (let i = 0; i < 5; i++) await service.record(PROJECT, "events", NOW);
		expect(await service.check(PROJECT, "events", NOW)).toEqual({
			allowed: true,
			retryAfterSeconds: 0,
		});
	});

	it("deja pasar hasta alcanzar el límite y luego rechaza con el tiempo de espera", async () => {
		const { service } = setup({ events: 3, transactions: null });
		for (let i = 0; i < 3; i++) {
			expect((await service.check(PROJECT, "events", NOW)).allowed).toBe(true);
			await service.record(PROJECT, "events", NOW);
		}
		expect(await service.check(PROJECT, "events", NOW)).toEqual({
			allowed: false,
			retryAfterSeconds: 3_600,
		});
	});

	it("cada tipo tiene su propio contador y su propio límite", async () => {
		const { service } = setup({ events: 1, transactions: 100 });
		await service.record(PROJECT, "events", NOW);
		expect((await service.check(PROJECT, "events", NOW)).allowed).toBe(false);
		expect((await service.check(PROJECT, "transactions", NOW)).allowed).toBe(
			true,
		);
	});

	it("el contador se reinicia al cambiar de mes", async () => {
		const { service } = setup({ events: 1, transactions: null });
		await service.record(PROJECT, "events", NOW);
		expect((await service.check(PROJECT, "events", NOW)).allowed).toBe(false);
		expect(
			(await service.check(PROJECT, "events", new Date("2026-11-01T00:00:01Z")))
				.allowed,
		).toBe(true);
	});

	it("si el contador no existe (Redis vacío) parte de lo que ya hay guardado este mes", async () => {
		const { service, repository } = setup(
			{ events: 10, transactions: null },
			{ events: 9, transactions: 0 },
		);
		expect((await service.check(PROJECT, "events", NOW)).allowed).toBe(true); // 9 de 10
		await service.record(PROJECT, "events", NOW);
		expect((await service.check(PROJECT, "events", NOW)).allowed).toBe(false); // 10 de 10
		expect(repository.countSince).toHaveBeenCalledTimes(1); // se reconstruye una sola vez
	});

	it("los límites se cachean y se pueden invalidar al cambiarlos", async () => {
		const { service, repository } = setup({ events: 5, transactions: null });
		await service.check(PROJECT, "events", NOW);
		await service.check(PROJECT, "events", NOW);
		expect(repository.limits).toHaveBeenCalledTimes(1);
		service.invalidate(PROJECT);
		await service.check(PROJECT, "events", NOW);
		expect(repository.limits).toHaveBeenCalledTimes(2);
	});

	it("usage resume el mes con lo usado y los límites", async () => {
		const { service } = setup(
			{ events: 100, transactions: null },
			{ events: 40, transactions: 7 },
		);
		expect(await service.usage(PROJECT, NOW)).toEqual({
			month: "2026-10",
			resetsAt: "2026-11-01T00:00:00.000Z",
			events: { used: 40, quota: 100 },
			transactions: { used: 7, quota: null },
		});
	});

	it("requireProject lanza 404 si el proyecto no es de la organización", async () => {
		const { service, repository } = setup({ events: null, transactions: null });
		(repository.projectInOrg as ReturnType<typeof vi.fn>).mockResolvedValue(
			false,
		);
		await expect(service.requireProject("org", PROJECT)).rejects.toMatchObject({
			status: 404,
		});
	});
});
