import type { ComponentType } from "react";
import { ErrorBoundary, type ErrorBoundaryProps } from "./error-boundary";

/** Envuelve un componente en un `ErrorBoundary` (útil para componentes que no controlas). */
export function withErrorBoundary<P extends object>(
	Wrapped: ComponentType<P>,
	boundaryProps: Omit<ErrorBoundaryProps, "children">,
): ComponentType<P> {
	const name = Wrapped.displayName || Wrapped.name || "Component";
	const WithBoundary = (props: P) => (
		<ErrorBoundary {...boundaryProps}>
			<Wrapped {...props} />
		</ErrorBoundary>
	);
	WithBoundary.displayName = `withErrorBoundary(${name})`;
	return WithBoundary;
}
