import type { WebVital } from "@sentinel/shared";

const DASH = "—";

/** 850 -> "850 ms"; 1840 -> "1.84 s". Sin dato, un guion. */
export function formatMs(
	value: number | null | undefined,
	locale: string,
): string {
	if (value === null || value === undefined) return DASH;
	if (value < 1_000) return `${Math.round(value)} ms`;
	const seconds = new Intl.NumberFormat(locale, {
		maximumFractionDigits: 2,
	}).format(value / 1_000);
	return `${seconds} s`;
}

/** 0.125 -> "12.5%". */
export function formatPercent(rate: number, locale: string): string {
	return new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 1,
	}).format(rate);
}

/** Transacciones por minuto, con los decimales necesarios para que no salga siempre "0". */
export function formatPerMinute(tpm: number, locale: string): string {
	const digits = tpm >= 10 ? 0 : tpm >= 1 ? 1 : 2;
	return new Intl.NumberFormat(locale, {
		maximumFractionDigits: digits,
	}).format(tpm);
}

/** CLS no tiene unidad; el resto son milisegundos. */
export function formatVital(
	vital: WebVital,
	value: number,
	locale: string,
): string {
	return vital === "cls"
		? new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(value)
		: formatMs(value, locale);
}

/** Posición (0–100 %) de un valor en una barra que va de 0 al doble del umbral "malo". */
export function vitalPosition(value: number, poor: number): number {
	return Math.min(100, Math.max(0, (value / (poor * 2)) * 100));
}

/** Escala del eje Y de un gráfico: el máximo redondeado hacia arriba a un número "bonito". */
export function niceMax(value: number): number {
	if (value <= 0) return 1;
	const magnitude = 10 ** Math.floor(Math.log10(value));
	const normalized = value / magnitude;
	const step =
		normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
	return step * magnitude;
}

import {
	SPAN_COLOR_DEFAULT,
	SPAN_COLORS,
} from "@/utils/performance/performance.constants";

/** `http.client` -> bg-info, `db.query` -> bg-success... */
export function spanColor(op: string): string {
	return (
		SPAN_COLORS.find(([prefix]) => op.startsWith(prefix))?.[1] ??
		SPAN_COLOR_DEFAULT
	);
}
