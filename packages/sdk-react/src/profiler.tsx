import { startSpan } from "@argus-isolator/browser";
import { type ComponentType, type ReactNode, useEffect, useRef } from "react";

export interface ProfilerProps {
	/** Nombre con el que aparece el span (`<Checkout>`). */
	name: string;
	children?: ReactNode;
}

/**
 * Mide cuánto tarda en montarse la parte del árbol que envuelve: del primer render al commit.
 * El span cuelga de la transacción en curso (la carga de página o la navegación); si no hay
 * ninguna, no hace nada. Solo mide el montaje, no cada actualización: así el coste es casi nulo.
 */
export function Profiler({ name, children }: ProfilerProps) {
	// Se fija en el primer render; el efecto corre cuando todo el subárbol ya está en pantalla.
	const startedAt = useRef<number>(Date.now());
	useEffect(() => {
		try {
			startSpan(
				"ui.react.mount",
				`<${name}>`,
				undefined,
				startedAt.current,
			)?.end();
		} catch {}
	}, [name]);
	return <>{children}</>;
}

/** Envuelve un componente en un `Profiler` (útil para componentes que no controlas). */
export function withProfiler<P extends object>(
	Wrapped: ComponentType<P>,
	name?: string,
): ComponentType<P> {
	const label = name ?? (Wrapped.displayName || Wrapped.name || "Component");
	const WithProfiler = (props: P) => (
		<Profiler name={label}>
			<Wrapped {...props} />
		</Profiler>
	);
	WithProfiler.displayName = `withProfiler(${label})`;
	return WithProfiler;
}
