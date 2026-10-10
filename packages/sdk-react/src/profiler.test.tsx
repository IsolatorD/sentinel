import * as Sentinel from "@sentinel/browser";
import { ingestTransactionSchema } from "@sentinel/shared";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Profiler, withProfiler } from "./index";
import { DSN } from "./test-utils";

const sent: Array<ReturnType<typeof ingestTransactionSchema.parse>> = [];

beforeEach(() => {
	sent.length = 0;
	vi.stubGlobal(
		"fetch",
		vi.fn(async (_url: string, init: { body: string }) => {
			const body = JSON.parse(init.body);
			if ("trace_id" in body) sent.push(ingestTransactionSchema.parse(body));
			return new Response(null, { status: 202 });
		}),
	);
	Sentinel.init({
		dsn: DSN,
		breadcrumbs: false,
		tracesSampleRate: 1,
		tracing: { pageload: false, navigation: false, http: false },
	});
});
afterEach(async () => {
	await Sentinel.close();
	vi.unstubAllGlobals();
});

describe("Profiler", () => {
	it("registra un span de montaje dentro de la transacción en curso", async () => {
		const tx = Sentinel.startTransaction({ name: "/checkout" });
		render(
			<Profiler name="Checkout">
				<p>contenido</p>
			</Profiler>,
		);
		expect(screen.getByText("contenido")).toBeInTheDocument();
		tx?.finish();
		await Sentinel.flush();

		expect(sent).toHaveLength(1);
		expect(sent[0].spans[0]).toMatchObject({
			op: "ui.react.mount",
			description: "<Checkout>",
			parent_span_id: sent[0].span_id,
		});
	});

	it("sin transacción en curso no hace nada y los hijos se muestran", async () => {
		render(
			<Profiler name="Solo">
				<p>hola</p>
			</Profiler>,
		);
		expect(screen.getByText("hola")).toBeInTheDocument();
		await Sentinel.flush();
		expect(sent).toHaveLength(0);
	});

	it("withProfiler usa el nombre del componente", async () => {
		const Cart = () => <p>carrito</p>;
		const Wrapped = withProfiler(Cart);
		expect(Wrapped.displayName).toBe("withProfiler(Cart)");
		const tx = Sentinel.startTransaction({ name: "/cart" });
		render(<Wrapped />);
		tx?.finish();
		await Sentinel.flush();
		expect(sent[0].spans[0].description).toBe("<Cart>");
	});
});
