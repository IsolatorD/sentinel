import { afterEach, describe, expect, it } from "vitest";
import pkg from "../package.json";
import * as Sentinel from "./index";
import { DSN } from "./test-utils";
import { SDK_VERSION } from "./version";

afterEach(async () => {
	await Sentinel.close();
});

describe("API pública", () => {
	it("antes de init todas las funciones son no-ops seguros", async () => {
		expect(Sentinel.getClient()).toBeUndefined();
		expect(Sentinel.captureException(new Error("x"))).toBeUndefined();
		expect(Sentinel.captureMessage("x")).toBeUndefined();
		expect(() => {
			Sentinel.addBreadcrumb({ message: "x" });
			Sentinel.setUser({ id: "1" });
			Sentinel.setTag("a", "b");
			Sentinel.setTags({ a: "b" });
			Sentinel.setContext("c", { a: 1 });
			Sentinel.setExtra("k", "v");
		}).not.toThrow();
		await expect(Sentinel.flush()).resolves.toBe(true);
		await expect(Sentinel.close()).resolves.toBe(true);
	});

	it("init devuelve el cliente y las funciones lo usan", () => {
		const client = Sentinel.init({ dsn: DSN, enabled: false });
		expect(Sentinel.getClient()).toBe(client);
		expect(client.enabled).toBe(false);
	});

	it("init con una DSN inválida no lanza", () => {
		expect(() => Sentinel.init({ dsn: "nada" })).not.toThrow();
		expect(Sentinel.getClient()?.enabled).toBe(false);
	});

	it("volver a llamar a init reemplaza al cliente anterior", () => {
		const first = Sentinel.init({ dsn: DSN, enabled: false });
		const second = Sentinel.init({ dsn: DSN, enabled: false });
		expect(second).not.toBe(first);
		expect(Sentinel.getClient()).toBe(second);
	});

	it("close desactiva el cliente global", async () => {
		Sentinel.init({ dsn: DSN, enabled: false });
		await Sentinel.close();
		expect(Sentinel.getClient()).toBeUndefined();
	});

	it("la versión exportada coincide con package.json", () => {
		expect(Sentinel.SDK_VERSION).toBe(pkg.version);
		expect(SDK_VERSION).toBe(pkg.version);
	});
});
