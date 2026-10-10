import type { VitalCardProps } from "@/components/molecules/VitalCard/VitalCardInterface";

/** Datos de muestra del recorte de producto que se enseña en la landing (no vienen de ninguna API). */
export const PREVIEW_ISSUES = [
	{
		level: "error",
		title: "TypeError: Cannot read properties of undefined (reading 'items')",
		culprit: "computeTotal (Cart.js:42)",
		events: 1284,
		users: 312,
		trend: [
			0, 1, 0, 2, 1, 3, 2, 4, 3, 5, 4, 6, 8, 7, 9, 12, 10, 14, 11, 16, 13, 18,
			15, 20,
		],
	},
	{
		level: "fatal",
		title: "PaymentError: Payment gateway rejected the order",
		culprit: "chargeCard (orders.js:88)",
		events: 96,
		users: 41,
		trend: [
			0, 0, 0, 0, 1, 0, 0, 2, 0, 1, 0, 0, 3, 0, 1, 0, 0, 2, 0, 0, 4, 0, 1, 2,
		],
	},
	{
		level: "warning",
		title: "ReferenceError: analytics is not defined",
		culprit: "trackPurchase (track.js:12)",
		events: 41,
		users: 28,
		trend: [
			2, 1, 2, 1, 2, 1, 1, 2, 1, 1, 2, 1, 1, 1, 2, 1, 1, 1, 1, 2, 1, 1, 1, 1,
		],
	},
] as const;

const HOUR = 3_600_000;
// Las últimas 24 horas, hasta la hora en punto: el gráfico siempre parece de ahora.
const START = Math.floor(Date.now() / HOUR) * HOUR - 23 * HOUR;
const P50 = [
	420, 440, 430, 460, 450, 470, 520, 610, 700, 760, 720, 690, 640, 600, 580,
	560, 540, 520, 500, 480, 470, 460, 450, 440,
];
const COUNT = [
	12, 9, 7, 6, 8, 14, 30, 58, 82, 96, 90, 88, 84, 80, 76, 72, 70, 64, 52, 44,
	34, 26, 20, 15,
];

export const PREVIEW_POINTS = P50.map((p50, i) => ({
	start: new Date(START + i * HOUR).toISOString(),
	count: COUNT[i],
	errors: i % 7 === 0 ? 1 : 0,
	p50,
	p95: Math.round(p50 * (2.4 + (i % 5) * 0.15)),
}));

export const PREVIEW_VITALS: VitalCardProps[] = [
	{ vital: "lcp", p75: 2140, samples: 1840, rating: "good" },
	{ vital: "cls", p75: 0.14, samples: 1840, rating: "needs-improvement" },
	{ vital: "inp", p75: 180, samples: 920, rating: "good" },
];
