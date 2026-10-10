import type { TRANSACTION_SORTS } from "@sentinel/shared";

/** Columnas por las que se puede ordenar, en el orden en que se muestran. */
export const SORTABLE: Array<{
	sort: (typeof TRANSACTION_SORTS)[number];
	align: "left" | "right";
}> = [
	{ sort: "count", align: "right" },
	{ sort: "p50", align: "right" },
	{ sort: "p95", align: "right" },
	{ sort: "errorRate", align: "right" },
	{ sort: "tpm", align: "right" },
	{ sort: "lastSeen", align: "right" },
];
