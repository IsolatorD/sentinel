import type { TransactionJobData } from "@sentinel/shared";
import { describe, expect, it } from "vitest";
import type {
	NewTransaction,
	TransactionRepository,
} from "./transaction.repository.js";
import { TransactionsService } from "./transactions.service.js";

function setup() {
	const saved: NewTransaction[] = [];
	const repo: TransactionRepository = {
		async save(tx) {
			saved.push(tx);
			return true;
		},
	};
	return { service: new TransactionsService(repo), saved };
}

const job = (
	over: Partial<TransactionJobData["transaction"]> = {},
	client = {},
): TransactionJobData => ({
	projectId: "proj-1",
	transactionId: "tx-1",
	receivedAt: "2026-10-09T12:00:00.000Z",
	client,
	transaction: {
		trace_id: "4BF92F3577B34DA6A3CE929D0E0E4736",
		span_id: "00F067AA0BA902B7",
		name: "/checkout",
		op: "pageload",
		duration_ms: 900,
		status: "ok",
		spans: [],
		...over,
	},
});

describe("TransactionsService", () => {
	it("normaliza los ids a minúsculas y copia los datos de la transacción", async () => {
		const { service, saved } = setup();
		await service.store(job({ release: "1.0.0", environment: "prod" }));
		expect(saved[0]).toMatchObject({
			id: "tx-1",
			projectId: "proj-1",
			traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
			spanId: "00f067aa0ba902b7",
			name: "/checkout",
			durationMs: 900,
			release: "1.0.0",
			environment: "prod",
			measurements: {},
			tags: {},
		});
	});

	it("sin fecha usa la de recepción; una fecha futura también", async () => {
		const { service, saved } = setup();
		await service.store(job());
		await service.store(job({ timestamp: "2099-01-01T00:00:00Z" }));
		expect(saved[0].timestamp.toISOString()).toBe("2026-10-09T12:00:00.000Z");
		expect(saved[1].timestamp.toISOString()).toBe("2026-10-09T12:00:00.000Z");
	});

	it("acepta epoch en segundos y en milisegundos", async () => {
		const { service, saved } = setup();
		await service.store(job({ timestamp: 1_760_000_000 }));
		await service.store(job({ timestamp: 1_760_000_000_000 }));
		expect(saved[0].timestamp.getTime()).toBe(saved[1].timestamp.getTime());
	});

	it("un span con fecha inválida arranca con la transacción", async () => {
		const { service, saved } = setup();
		await service.store(
			job({
				timestamp: "2026-10-09T11:00:00Z",
				spans: [
					{
						span_id: "B9C7C989F97918E1",
						op: "db.query",
						start_timestamp: "no es una fecha",
						duration_ms: 5,
					},
				],
			}),
		);
		expect(saved[0].spans[0]).toMatchObject({ spanId: "b9c7c989f97918e1" });
		expect(saved[0].spans[0].startTimestamp.toISOString()).toBe(
			"2026-10-09T11:00:00.000Z",
		);
	});

	it("identifica al usuario por id, correo, nombre o IP del cliente", async () => {
		const { service, saved } = setup();
		await service.store(job({ user: { email: "a@b.c" } }));
		await service.store(job({}, { ip: "1.2.3.4" }));
		expect(saved[0].userIdentifier).toBe("a@b.c");
		expect(saved[1].userIdentifier).toBe("1.2.3.4");
	});
});
