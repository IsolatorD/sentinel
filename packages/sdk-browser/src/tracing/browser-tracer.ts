import {
	type StartTransactionContext,
	Tracer,
	type TracerConfig,
	type TracerDeps,
	type Transaction,
} from "@sentinel/core";
import { collectWebVitals } from "./web-vitals";

export interface BrowserTracerConfig extends TracerConfig {
	pageload: boolean;
	navigation: boolean;
	webVitals: boolean;
}

/** El tracer del navegador: además de lo común, mide la carga de la página y las navegaciones. */
export class BrowserTracer extends Tracer {
	/** La transacción automática (pageload/navegación) en curso, para cerrarla al navegar. */
	private autoTx?: Transaction;
	private cleanups: Array<() => void> = [];

	constructor(
		override readonly config: BrowserTracerConfig,
		deps: TracerDeps,
	) {
		super(config, deps);
	}

	/** Transacción de la carga de página: desde el inicio de la navegación hasta que la página se asienta. */
	startPageload(): void {
		if (!this.config.pageload || typeof window === "undefined") return;
		const start =
			typeof performance !== "undefined" && performance.timeOrigin
				? performance.timeOrigin
				: this.clock();
		const vitals = this.config.webVitals ? collectWebVitals() : undefined;

		const tx = this.startAuto({
			name: location.pathname || "/",
			op: "pageload",
			startTimestamp: start,
			beforeFinish: (t) => {
				if (!vitals) return;
				for (const [name, m] of Object.entries(vitals.read()))
					t.setMeasurement(name, m.value, m.unit);
				vitals.stop();
			},
		});
		if (vitals) this.cleanups.push(() => vitals.stop());

		// La página no está "lista" hasta el evento load.
		const release = tx.hold();
		if (document.readyState === "complete") release();
		else {
			window.addEventListener("load", release, { once: true });
			this.cleanups.push(() => window.removeEventListener("load", release));
		}

		// Al ocultarse la pestaña no se puede garantizar nada más: se cierra con lo que haya.
		const onHidden = () => {
			if (document.visibilityState === "hidden") this.autoTx?.finish();
		};
		document.addEventListener("visibilitychange", onHidden);
		this.cleanups.push(() =>
			document.removeEventListener("visibilitychange", onHidden),
		);
	}

	/** Cambio de URL sin recargar (SPA): cierra la transacción anterior y abre una de navegación. */
	onNavigation(_from: string, to: string): void {
		if (!this.config.navigation) return;
		let pathname: string;
		try {
			pathname = new URL(to, location.href).pathname;
		} catch {
			return;
		}
		// Solo cambió la query o el hash: sigue siendo la misma pantalla.
		if (this.autoTx && this.autoTx.name === pathname && !this.autoTx.finished)
			return;
		this.autoTx?.finish();
		this.startAuto({ name: pathname, op: "navigation" });
	}

	override destroy(): void {
		super.destroy();
		this.autoTx?.finish();
		for (const cleanup of this.cleanups.splice(0)) cleanup();
	}

	protected override onTransactionFinished(tx: Transaction): void {
		if (this.autoTx === tx) this.autoTx = undefined;
	}

	private startAuto(ctx: StartTransactionContext): Transaction {
		const tx = this.startTransaction({ ...ctx, idle: true });
		this.autoTx = tx;
		return tx;
	}

	/** En un navegador, las rutas relativas se muestran sin origen y las de otro origen con él. */
	protected override describeUrl(url: string): string {
		try {
			const parsed = new URL(url, location.href);
			return parsed.origin === location.origin
				? parsed.pathname
				: `${parsed.origin}${parsed.pathname}`;
		} catch {
			return url;
		}
	}

	/** Por defecto solo al mismo origen: a otro obliga a una petición previa CORS. */
	protected override shouldPropagate(url: string): boolean {
		let absolute: URL;
		try {
			absolute = new URL(url, location.href);
		} catch {
			return false;
		}
		const targets = this.config.propagationTargets;
		if (!targets) return absolute.origin === location.origin;
		return targets.some((t) =>
			typeof t === "string" ? absolute.href.includes(t) : t.test(absolute.href),
		);
	}
}
