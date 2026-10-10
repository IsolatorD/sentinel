import type { Measurement } from "@sentinel/core";

export interface VitalsCollector {
	/** Valores actuales; solo incluye los que ya se han podido medir. */
	read(): Record<string, Measurement>;
	stop(): void;
}

interface LayoutShiftEntry extends PerformanceEntry {
	value: number;
	hadRecentInput: boolean;
}
interface EventTimingEntry extends PerformanceEntry {
	interactionId?: number;
}

type Handler = (entries: PerformanceEntry[]) => void;

/**
 * Mide los Web Vitals con `PerformanceObserver`: FCP, LCP, CLS, INP y TTFB. Si el navegador no
 * soporta algún tipo de entrada, simplemente no se mide. Nunca lanza.
 */
export function collectWebVitals(): VitalsCollector {
	const observers: PerformanceObserver[] = [];
	let fcp: number | undefined;
	let lcp: number | undefined;

	// CLS: ventanas de sesión (huecos < 1 s, máximo 5 s); vale la peor ventana.
	let cls: number | undefined;
	let windowValue = 0;
	let windowStart = 0;
	let windowLast = 0;

	// INP: la peor interacción (con pocas interacciones) o un percentil alto.
	const interactions = new Map<number, number>();

	const observe = (
		type: string,
		handler: Handler,
		extra: Record<string, unknown> = {},
	) => {
		try {
			if (typeof PerformanceObserver === "undefined") return;
			const supported = PerformanceObserver.supportedEntryTypes;
			if (supported && !supported.includes(type)) return;
			const observer = new PerformanceObserver((list) => {
				try {
					handler(list.getEntries());
				} catch {}
			});
			observer.observe({
				type,
				buffered: true,
				...extra,
			} as PerformanceObserverInit);
			observers.push(observer);
		} catch {}
	};

	observe("paint", (entries) => {
		for (const e of entries)
			if (e.name === "first-contentful-paint") fcp = e.startTime;
	});
	observe("largest-contentful-paint", (entries) => {
		const last = entries.at(-1);
		if (last) lcp = last.startTime;
	});
	observe("layout-shift", (entries) => {
		for (const e of entries as LayoutShiftEntry[]) {
			if (e.hadRecentInput) continue;
			const newWindow =
				windowValue === 0 ||
				e.startTime - windowLast > 1_000 ||
				e.startTime - windowStart > 5_000;
			if (newWindow) {
				windowValue = e.value;
				windowStart = e.startTime;
			} else windowValue += e.value;
			windowLast = e.startTime;
			cls = Math.max(cls ?? 0, windowValue);
		}
	});
	observe(
		"event",
		(entries) => {
			for (const e of entries as EventTimingEntry[]) {
				if (!e.interactionId) continue;
				interactions.set(
					e.interactionId,
					Math.max(interactions.get(e.interactionId) ?? 0, e.duration),
				);
			}
		},
		{ durationThreshold: 40 },
	);

	return {
		read() {
			const out: Record<string, Measurement> = {};
			const ms = (value: number) => ({
				value: Math.round(value),
				unit: "millisecond",
			});
			if (fcp !== undefined) out.fcp = ms(fcp);
			if (lcp !== undefined) out.lcp = ms(lcp);
			if (cls !== undefined) out.cls = { value: Math.round(cls * 1000) / 1000 };
			if (interactions.size > 0) {
				const sorted = [...interactions.values()].sort((a, b) => b - a);
				out.inp = ms(
					sorted[Math.min(sorted.length - 1, Math.floor(sorted.length / 50))],
				);
			}
			try {
				const nav = performance.getEntriesByType("navigation")[0] as
					| PerformanceNavigationTiming
					| undefined;
				if (nav && nav.responseStart > 0) out.ttfb = ms(nav.responseStart);
			} catch {}
			return out;
		},
		stop() {
			for (const o of observers.splice(0)) {
				try {
					o.disconnect();
				} catch {}
			}
		},
	};
}
