import { type ComponentType, type ReactNode, useEffect, useRef } from "react";
import { getClient } from "./hub";

export interface ProfilerProps {
	/** Nombre con el que aparece el span (`<Checkout>`). */
	name: string;
	children?: ReactNode;
}

/**
 * Mide cuánto tarda en montarse la parte del árbol que envuelve (del primer render al commit) como un
 * span `ui.react.mount` de la transacción en curso: normalmente la pantalla que se está abriendo.
 */
export function Profiler({ name, children }: ProfilerProps) {
	const startedAt = useRef<number>(Date.now());
	useEffect(() => {
		try {
			getClient()
				?.startSpan("ui.react.mount", `<${name}>`, undefined, startedAt.current)
				?.end();
		} catch {}
	}, [name]);
	return <>{children}</>;
}

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
