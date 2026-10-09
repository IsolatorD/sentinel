import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	applyTheme,
	isThemePreference,
	readThemePreference,
	resolveTheme,
	setThemePreference,
	subscribeTheme,
} from "./theme";

const mockSystem = (dark: boolean) => {
	const listeners = new Set<() => void>();
	vi.spyOn(window, "matchMedia").mockImplementation(
		() =>
			({
				matches: dark,
				addEventListener: (_: string, l: () => void) => listeners.add(l),
				removeEventListener: (_: string, l: () => void) => listeners.delete(l),
			}) as unknown as MediaQueryList,
	);
	return listeners;
};

beforeEach(() => {
	window.localStorage.clear();
	document.documentElement.removeAttribute("data-theme");
	document.documentElement.style.colorScheme = "";
});
afterEach(() => vi.restoreAllMocks());

describe("resolveTheme", () => {
	it("una elección explícita manda; 'sistema' sigue al sistema", () => {
		expect(resolveTheme("light", true)).toBe("light");
		expect(resolveTheme("dark", false)).toBe("dark");
		expect(resolveTheme("system", true)).toBe("dark");
		expect(resolveTheme("system", false)).toBe("light");
	});
});

describe("isThemePreference", () => {
	it("solo acepta los valores conocidos", () => {
		for (const ok of ["system", "light", "dark"])
			expect(isThemePreference(ok)).toBe(true);
		for (const bad of ["Dark", "auto", "", null, undefined, 1])
			expect(isThemePreference(bad)).toBe(false);
	});
});

describe("readThemePreference", () => {
	it("sin nada guardado, o con un valor inválido, sigue al sistema", () => {
		expect(readThemePreference()).toBe("system");
		window.localStorage.setItem("sentinel:theme", "violeta");
		expect(readThemePreference()).toBe("system");
	});

	it("devuelve lo guardado", () => {
		window.localStorage.setItem("sentinel:theme", "dark");
		expect(readThemePreference()).toBe("dark");
	});
});

describe("applyTheme", () => {
	it("marca el documento con el tema y el esquema de color nativo", () => {
		mockSystem(false);
		expect(applyTheme("dark")).toBe("dark");
		expect(document.documentElement.dataset.theme).toBe("dark");
		expect(document.documentElement.style.colorScheme).toBe("dark");
	});

	it("con 'sistema' usa el del sistema", () => {
		mockSystem(true);
		expect(applyTheme("system")).toBe("dark");
	});
});

describe("setThemePreference y subscribeTheme", () => {
	it("guarda, aplica y avisa a quien escucha", () => {
		mockSystem(false);
		const listener = vi.fn();
		const unsubscribe = subscribeTheme(listener);
		setThemePreference("dark");
		expect(window.localStorage.getItem("sentinel:theme")).toBe("dark");
		expect(document.documentElement.dataset.theme).toBe("dark");
		expect(listener).toHaveBeenCalledTimes(1);

		unsubscribe();
		setThemePreference("light");
		expect(listener).toHaveBeenCalledTimes(1);
	});

	it("si cambia el sistema estando en 'sistema', se vuelve a aplicar", () => {
		const system = mockSystem(false);
		const unsubscribe = subscribeTheme(() => {});
		setThemePreference("system");
		expect(document.documentElement.dataset.theme).toBe("light");

		mockSystem(true);
		for (const onChange of system) onChange();
		expect(document.documentElement.dataset.theme).toBe("dark");
		unsubscribe();
	});
});
