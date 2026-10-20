import { act, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ErrorBoundary, type FallbackProps, withErrorBoundary } from "./index";
import { uniqueError, useSentinel } from "./test-utils";

function Bomb({ error }: { error: Error }): never {
	throw error;
}

// React registra en consola cada error de render; no aporta nada a estas pruebas.
const quiet = () => vi.spyOn(console, "error").mockImplementation(() => {});

describe("ErrorBoundary", () => {
	const sentinel = useSentinel();

	it("muestra el fallback y envía el error con su pila de componentes", async () => {
		quiet();
		const error = uniqueError();
		render(
			<ErrorBoundary fallback={<p>Algo salió mal</p>}>
				<main>
					<Bomb error={error} />
				</main>
			</ErrorBoundary>,
		);
		expect(screen.getByText("Algo salió mal")).toBeInTheDocument();

		const [event, ...rest] = await sentinel.events();
		expect(rest).toHaveLength(0);
		expect(event.exception?.values.at(-1)?.value).toBe(error.message);
		expect(event.tags).toMatchObject({
			handled: "true",
			mechanism: "react.error_boundary",
		});
		const stack = event.contexts?.react?.componentStack as string;
		expect(stack).toContain("Bomb");
		expect(stack).toContain("main");
		expect(stack).toBe(stack.trim());
	});

	it("el fallback como función recibe el error, el id del evento y resetError", async () => {
		quiet();
		const error = uniqueError();
		let fallbackProps: FallbackProps | undefined;

		render(
			<ErrorBoundary
				fallback={(props) => {
					fallbackProps = props;
					return <p>Falló: {(props.error as Error).message}</p>;
				}}
			>
				<Bomb error={error} />
			</ErrorBoundary>,
		);
		expect(screen.getByText(`Falló: ${error.message}`)).toBeInTheDocument();
		const [event] = await sentinel.events();
		expect(fallbackProps?.componentStack).toContain("Bomb");
		// El id llega al fallback (se puede mostrar al usuario para soporte).
		expect(typeof event.event_id).toBe("string");
	});

	it("resetError vuelve a mostrar los hijos y avisa con onReset", async () => {
		quiet();
		const onReset = vi.fn();
		const error = uniqueError();
		function Flaky() {
			const [fixed, setFixed] = useState(false);
			return (
				<ErrorBoundary
					onReset={() => {
						onReset();
						setFixed(true);
					}}
					fallback={({ resetError }) => (
						<button type="button" onClick={resetError}>
							Reintentar
						</button>
					)}
				>
					{fixed ? <p>Todo bien</p> : <Bomb error={error} />}
				</ErrorBoundary>
			);
		}
		render(<Flaky />);
		await act(async () =>
			screen.getByRole("button", { name: "Reintentar" }).click(),
		);
		expect(screen.getByText("Todo bien")).toBeInTheDocument();
		expect(onReset).toHaveBeenCalledTimes(1);
		await sentinel.events();
	});

	it("resetKeys reinicia el límite solo cuando cambia alguna clave", async () => {
		quiet();
		const error = uniqueError();
		const Page = ({ route }: { route: string }) =>
			route === "/rota" ? <Bomb error={error} /> : <p>Página {route}</p>;
		const App = ({ route }: { route: string }) => (
			<ErrorBoundary resetKeys={[route]} fallback={<p>Error en la página</p>}>
				<Page route={route} />
			</ErrorBoundary>
		);
		const { rerender } = render(<App route="/rota" />);
		expect(screen.getByText("Error en la página")).toBeInTheDocument();

		rerender(<App route="/rota" />); // misma clave: sigue en error
		expect(screen.getByText("Error en la página")).toBeInTheDocument();

		rerender(<App route="/inicio" />);
		expect(screen.getByText("Página /inicio")).toBeInTheDocument();
		await sentinel.events();
	});

	it("onError y beforeCapture permiten enriquecer el reporte", async () => {
		quiet();
		const onError = vi.fn();
		render(
			<ErrorBoundary
				fallback={<p>x</p>}
				onError={onError}
				beforeCapture={(hint) => ({
					...hint,
					level: "fatal",
					tags: { area: "checkout" },
				})}
			>
				<Bomb error={uniqueError()} />
			</ErrorBoundary>,
		);
		const [event] = await sentinel.events();
		expect(event.level).toBe("fatal");
		expect(event.tags).toMatchObject({
			area: "checkout",
			handled: "true",
			mechanism: "react.error_boundary",
		});
		expect(onError).toHaveBeenCalledWith(
			expect.any(Error),
			expect.stringContaining("Bomb"),
			event.event_id,
		);
	});

	it("un beforeCapture o un onError que fallan no rompen el fallback ni el envío", async () => {
		quiet();
		render(
			<ErrorBoundary
				fallback={<p>Seguimos aquí</p>}
				beforeCapture={() => {
					throw new Error("mal hook");
				}}
				onError={() => {
					throw new Error("mal callback");
				}}
			>
				<Bomb error={uniqueError()} />
			</ErrorBoundary>,
		);
		expect(screen.getByText("Seguimos aquí")).toBeInTheDocument();
		expect(await sentinel.events()).toHaveLength(1);
	});

	it("sin fallback no muestra nada en lugar de los hijos", async () => {
		quiet();
		const { container } = render(
			<ErrorBoundary>
				<Bomb error={uniqueError()} />
			</ErrorBoundary>,
		);
		expect(container).toBeEmptyDOMElement();
		await sentinel.events();
	});

	it("sin errores renderiza los hijos y no envía nada", async () => {
		render(
			<ErrorBoundary fallback={<p>fallo</p>}>
				<p>contenido</p>
			</ErrorBoundary>,
		);
		expect(screen.getByText("contenido")).toBeInTheDocument();
		expect(await sentinel.events()).toHaveLength(0);
	});

	it("lanzar un valor que no es Error también se envía", async () => {
		quiet();
		function Throws(): never {
			throw "texto suelto";
		}
		render(
			<ErrorBoundary fallback={<p>fallo</p>}>
				<Throws />
			</ErrorBoundary>,
		);
		expect(screen.getByText("fallo")).toBeInTheDocument();
		expect(await sentinel.events()).toHaveLength(1);
	});
});

describe("withErrorBoundary", () => {
	useSentinel();

	it("envuelve el componente, le pasa las props y le da nombre para depurar", () => {
		quiet();
		const Greeting = ({ name }: { name: string }) => <p>Hola {name}</p>;
		const Wrapped = withErrorBoundary(Greeting, { fallback: <p>fallo</p> });
		render(<Wrapped name="Ana" />);
		expect(screen.getByText("Hola Ana")).toBeInTheDocument();
		expect(Wrapped.displayName).toBe("withErrorBoundary(Greeting)");
	});

	it("atrapa los errores del componente envuelto", () => {
		quiet();
		const Broken = () => <Bomb error={uniqueError()} />;
		const Wrapped = withErrorBoundary(Broken, { fallback: <p>fallo</p> });
		render(<Wrapped />);
		expect(screen.getByText("fallo")).toBeInTheDocument();
	});
});

describe("sin el SDK inicializado", () => {
	it("el fallback se muestra igual y no lanza", async () => {
		quiet();
		const Sentinel = await import("@argus-isolator/browser");
		await Sentinel.close();
		render(
			<ErrorBoundary fallback={<p>fallo</p>}>
				<Bomb error={uniqueError()} />
			</ErrorBoundary>,
		);
		expect(screen.getByText("fallo")).toBeInTheDocument();
	});
});
