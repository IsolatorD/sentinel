import { describe, expect, it } from "vitest";
import { exceptionFromUnknown } from "./exception";

describe("exceptionFromUnknown", () => {
	it("describe un Error con su tipo, mensaje y stacktrace", () => {
		const values = exceptionFromUnknown(new RangeError("fuera de rango"));
		expect(values).toHaveLength(1);
		expect(values[0]).toMatchObject({
			type: "RangeError",
			value: "fuera de rango",
		});
		expect(values[0].stacktrace?.frames.length).toBeGreaterThan(0);
	});

	it("usa el nombre de clases propias", () => {
		class PaymentError extends Error {
			override name = "PaymentError";
		}
		expect(exceptionFromUnknown(new PaymentError("rechazado"))[0].type).toBe(
			"PaymentError",
		);
	});

	it("encadena las causas: la más profunda primero y la principal al final", () => {
		const root = new Error("conexión perdida");
		const mid = new Error("no se pudo guardar", { cause: root });
		const top = new TypeError("falló el checkout", { cause: mid });
		const values = exceptionFromUnknown(top);
		expect(values.map((v) => v.value)).toEqual([
			"conexión perdida",
			"no se pudo guardar",
			"falló el checkout",
		]);
		expect(values.at(-1)?.type).toBe("TypeError");
	});

	it("no entra en bucle con causas circulares", () => {
		const a = new Error("a");
		const b = new Error("b", { cause: a });
		(a as { cause?: unknown }).cause = b;
		expect(exceptionFromUnknown(b).length).toBeLessThanOrEqual(2);
	});

	it("una causa que no es Error se conserva como contexto", () => {
		const values = exceptionFromUnknown(
			new Error("falló", { cause: "timeout" }),
		);
		expect(values).toHaveLength(2);
		expect(values[0].value).toBe("timeout");
	});

	it("captura valores que no son Error (string, objeto, número, null)", () => {
		expect(exceptionFromUnknown("algo salió mal")[0]).toEqual({
			type: "Error",
			value: "Non-Error exception captured with value: algo salió mal",
		});
		expect(exceptionFromUnknown({ code: 42 })[0].value).toContain(
			'{"code":42}',
		);
		expect(exceptionFromUnknown(null)[0].value).toContain("null");
		expect(exceptionFromUnknown(undefined)[0].value).toContain("undefined");
	});

	it("permite personalizar el tipo y prefijo (unhandledrejection)", () => {
		const [v] = exceptionFromUnknown("rechazada", {
			nonErrorType: "UnhandledRejection",
			nonErrorPrefix: "Non-Error promise rejection captured with value: ",
		});
		expect(v).toEqual({
			type: "UnhandledRejection",
			value: "Non-Error promise rejection captured with value: rechazada",
		});
	});

	it("acepta objetos con forma de error (p. ej. DOMException de otro realm)", () => {
		const fake = {
			name: "AbortError",
			message: "cancelado",
			stack: "AbortError: cancelado",
		};
		expect(exceptionFromUnknown(fake)[0]).toMatchObject({
			type: "AbortError",
			value: "cancelado",
		});
	});
});
