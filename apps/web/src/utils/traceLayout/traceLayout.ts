import type { TraceDto, TraceTransaction } from "@sentinel/shared";
import type {
	TraceLayout,
	TraceRow,
} from "@/utils/traceLayout/traceLayoutInterface";

/**
 * Ordena las transacciones como un árbol (cada una bajo la que la originó) y calcula dónde empieza
 * cada una respecto al inicio de la traza. Un error se asigna a la transacción cuyo span raíz coincide
 * con el span que traía; si ninguna coincide, queda suelto.
 */
export function layoutTrace(trace: TraceDto): TraceLayout {
	const starts = trace.transactions.map((t) => Date.parse(t.timestamp));
	const origin = Math.min(...starts, Number.POSITIVE_INFINITY);
	const byId = new Map(trace.transactions.map((t) => [t.id, t]));

	const children = new Map<string | null, TraceTransaction[]>();
	for (const tx of trace.transactions) {
		// Un padre desconocido (o ella misma) deja la transacción en la raíz.
		const parent =
			tx.parentTransactionId &&
			tx.parentTransactionId !== tx.id &&
			byId.has(tx.parentTransactionId)
				? tx.parentTransactionId
				: null;
		children.set(parent, [...(children.get(parent) ?? []), tx]);
	}

	const eventsBySpan = new Map<string, string[]>();
	const assigned = new Set<string>();
	for (const e of trace.events) {
		if (!e.spanId) continue;
		eventsBySpan.set(e.spanId, [...(eventsBySpan.get(e.spanId) ?? []), e.id]);
	}

	const rows: TraceRow[] = [];
	const visited = new Set<string>();
	const add = (tx: TraceTransaction, depth: number) => {
		visited.add(tx.id);
		const eventIds = eventsBySpan.get(tx.spanId) ?? [];
		for (const id of eventIds) assigned.add(id);
		rows.push({
			transaction: tx,
			depth,
			offsetMs: Math.max(0, Date.parse(tx.timestamp) - origin),
			eventIds,
		});
		walk(tx.id, depth + 1);
	};
	const walk = (parent: string | null, depth: number) => {
		for (const tx of children.get(parent) ?? [])
			if (!visited.has(tx.id)) add(tx, depth);
	};
	walk(null, 0);
	// Lo que quedó fuera por un ciclo en datos corruptos se añade sin anidar.
	for (const tx of trace.transactions) if (!visited.has(tx.id)) add(tx, 0);

	const totalMs = Math.max(
		1,
		...rows.map((r) => r.offsetMs + r.transaction.durationMs),
	);
	return {
		rows,
		totalMs,
		loose: trace.events.filter((e) => !assigned.has(e.id)).map((e) => e.id),
	};
}
