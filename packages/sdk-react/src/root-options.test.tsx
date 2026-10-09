import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary, reactRootOptions } from "./index";
import { uniqueError, useSentinel } from "./test-utils";

(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = false;

function Bomb({ error }: { error: Error }): never {
	throw error;
}

const mounted: Array<() => void> = [];
afterEach(() => {
	for (const unmount of mounted.splice(0)) unmount();
});

async function mount(
	element: React.ReactNode,
	options: ReturnType<typeof reactRootOptions>,
) {
	vi.spyOn(console, "error").mockImplementation(() => {});
	const container = document.createElement("div");
	const root = createRoot(container, options);
	mounted.push(() => root.unmount());
	// Fuera de `act`: dentro, React relanza los errores no manejados en lugar de llamar a `onUncaughtError`.
	root.render(element);
	await new Promise((resolve) => setTimeout(resolve, 50));
	return container;
}

describe("reactRootOptions", () => {
	const sentinel = useSentinel();

	it("onUncaughtError: un error sin ErrorBoundary se envía como no manejado, una sola vez", async () => {
		const error = uniqueError();
		await mount(<Bomb error={error} />, reactRootOptions());
		const events = await sentinel.events();
		expect(events).toHaveLength(1);
		expect(events[0].tags).toMatchObject({
			handled: "false",
			mechanism: "react.uncaught",
		});
		const stack = events[0].contexts?.react?.componentStack as string;
		expect(stack).toContain("Bomb");
	});

	it("onCaughtError: un ErrorBoundary de terceros (que no envía nada) queda cubierto", async () => {
		class ThirdParty extends (await import("react")).Component<
			{ children: React.ReactNode },
			{ failed: boolean }
		> {
			state = { failed: false };
			static getDerivedStateFromError() {
				return { failed: true };
			}
			render() {
				return this.state.failed ? <p>fallo</p> : this.props.children;
			}
		}
		const container = await mount(
			<ThirdParty>
				<Bomb error={uniqueError()} />
			</ThirdParty>,
			reactRootOptions(),
		);
		expect(container.textContent).toBe("fallo");
		const events = await sentinel.events();
		expect(events).toHaveLength(1);
		expect(events[0].tags).toMatchObject({
			handled: "true",
			mechanism: "react.caught",
		});
	});

	it("con nuestro ErrorBoundary y onCaughtError a la vez, el error se envía una sola vez", async () => {
		await mount(
			<ErrorBoundary fallback={<p>fallo</p>}>
				<Bomb error={uniqueError()} />
			</ErrorBoundary>,
			reactRootOptions(),
		);
		expect(await sentinel.events()).toHaveLength(1);
	});

	it("onRecoverableError se envía como advertencia", async () => {
		const options = reactRootOptions();
		options.onRecoverableError(uniqueError("hidratación"), {
			componentStack: "\n    at Header",
		});
		const [event] = await sentinel.events();
		expect(event.level).toBe("warning");
		expect(event.tags).toMatchObject({
			handled: "true",
			mechanism: "react.recoverable",
		});
	});

	it("el callback recibe el error y el id del evento; si falla, no afecta al reporte", async () => {
		const callback = vi.fn(() => {
			throw new Error("callback roto");
		});
		const error = uniqueError();
		await mount(<Bomb error={error} />, reactRootOptions(callback));
		const [event] = await sentinel.events();
		expect(callback).toHaveBeenCalledWith(
			error,
			expect.objectContaining({ componentStack: expect.any(String) }),
			event.event_id,
		);
	});
});
