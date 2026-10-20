import type { CaptureHint } from "@argus-isolator/browser";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { captureReactError } from "./capture";

export interface FallbackProps {
	error: unknown;
	componentStack: string;
	/** Id del evento enviado; `undefined` si el SDK no está activo. */
	eventId: string | undefined;
	/** Vuelve a mostrar los hijos (p. ej. desde un botón "Reintentar"). */
	resetError: () => void;
}

export interface ErrorBoundaryProps {
	children?: ReactNode;
	/** Qué mostrar cuando un hijo falla. Sin esto, no se muestra nada en su lugar. */
	fallback?: ReactNode | ((props: FallbackProps) => ReactNode);
	/** Se llama tras enviar el error (para tu propio registro, métricas, etc.). */
	onError?: (
		error: unknown,
		componentStack: string,
		eventId: string | undefined,
	) => void;
	/** Se llama al volver a mostrar los hijos. */
	onReset?: (
		error: unknown,
		componentStack: string,
		eventId: string | undefined,
	) => void;
	/** Permite añadir tags, extra o cambiar el nivel antes de enviar. */
	beforeCapture?: (
		hint: CaptureHint,
		error: unknown,
		componentStack: string,
	) => CaptureHint | undefined;
	/** Si cambia alguno de estos valores (p. ej. la ruta), el límite se reinicia solo. */
	resetKeys?: unknown[];
}

interface State {
	failed: boolean;
	error: unknown;
	componentStack: string;
	eventId: string | undefined;
}

const initialState: State = {
	failed: false,
	error: undefined,
	componentStack: "",
	eventId: undefined,
};

const keysChanged = (a: unknown[] = [], b: unknown[] = []) =>
	a.length !== b.length || a.some((item, i) => !Object.is(item, b[i]));

/**
 * Atrapa los errores de render de sus hijos, los envía a Sentinel (con la pila de componentes)
 * y muestra `fallback` en lugar de dejar la pantalla en blanco.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, State> {
	state: State = initialState;

	static getDerivedStateFromError(error: unknown): Partial<State> {
		return { failed: true, error };
	}

	componentDidCatch(error: unknown, info: ErrorInfo): void {
		const componentStack = info.componentStack ?? "";
		const { beforeCapture, onError } = this.props;

		let hint: CaptureHint = {};
		try {
			hint = beforeCapture?.({}, error, componentStack) ?? {};
		} catch {
			// Un `beforeCapture` defectuoso no debe impedir el reporte ni romper el fallback.
		}
		const eventId = captureReactError(error, {
			componentStack,
			handled: true,
			mechanism: "react.error_boundary",
			hint,
		});

		this.setState({ componentStack, eventId });
		try {
			onError?.(error, componentStack, eventId);
		} catch {}
	}

	componentDidUpdate(prev: ErrorBoundaryProps): void {
		if (
			this.state.failed &&
			keysChanged(prev.resetKeys, this.props.resetKeys)
		) {
			this.resetError();
		}
	}

	resetError = (): void => {
		const { error, componentStack, eventId } = this.state;
		this.props.onReset?.(error, componentStack, eventId);
		this.setState(initialState);
	};

	render(): ReactNode {
		if (!this.state.failed) return this.props.children;
		const { fallback } = this.props;
		if (typeof fallback === "function") {
			return fallback({
				error: this.state.error,
				componentStack: this.state.componentStack,
				eventId: this.state.eventId,
				resetError: this.resetError,
			});
		}
		return fallback ?? null;
	}
}
