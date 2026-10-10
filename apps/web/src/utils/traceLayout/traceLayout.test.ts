import { describe, expect, it } from "vitest";
import * as fx from "@/test/fixtures";
import { layoutTrace } from "@/utils/traceLayout/traceLayout";

describe("layoutTrace", () => {
	it("anida el servidor bajo el navegador y calcula los desfases y la duración total", () => {
		const layout = layoutTrace(fx.trace());
		expect(
			layout.rows.map((r) => [r.transaction.name, r.depth, r.offsetMs]),
		).toEqual([
			["/checkout", 0, 0],
			["POST /api/orders", 1, 300],
		]);
		// La traza dura hasta que termina la última: el servidor acaba a los 700 ms, el navegador a los 1000.
		expect(layout.totalMs).toBe(1000);
	});

	it("asigna cada error a la transacción de su span y deja el resto sueltos", () => {
		const layout = layoutTrace(fx.trace());
		const server = layout.rows.find((r) => r.transaction.id === fx.SERVER_TX);
		expect(server?.eventIds).toEqual(["e1e1e1e1-1111-4a2b-8c3d-aaaaaaaaaaaa"]);
		expect(layout.loose).toEqual(["e2e2e2e2-2222-4a2b-8c3d-bbbbbbbbbbbb"]);
	});

	it("un padre desconocido deja la transacción en la raíz", () => {
		const base = fx.trace();
		const layout = layoutTrace({
			...base,
			transactions: base.transactions.map((t) => ({
				...t,
				parentTransactionId: t.parentTransactionId
					? "00000000-0000-4000-8000-000000000000"
					: null,
			})),
		});
		expect(layout.rows.map((r) => r.depth)).toEqual([0, 0]);
	});

	it("un ciclo entre padres (datos corruptos) no cuelga y muestra todas las transacciones", () => {
		const base = fx.trace();
		const [a, b] = base.transactions;
		const layout = layoutTrace({
			...base,
			transactions: [
				{ ...a, parentTransactionId: b.id },
				{ ...b, parentTransactionId: a.id },
			],
		});
		expect(layout.rows).toHaveLength(2);
	});

	it("sin transacciones, la duración mínima es 1 ms (no divide por cero)", () => {
		expect(
			layoutTrace({ traceId: fx.TRACE_ID, transactions: [], events: [] })
				.totalMs,
		).toBe(1);
	});
});
