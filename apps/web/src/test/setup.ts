import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeAll } from "vitest";
import i18n from "@/i18n";
import { apiClient } from "@/services/http/http.constants";

beforeAll(async () => {
	// Las aserciones de los tests están en inglés, sin importar el idioma del entorno.
	await i18n.changeLanguage("en");
});

// Ningún test sale a la red: lo que no se simula con `vi.mock` falla como una caída de red. Sin esto,
// axios (a diferencia de `fetch` con URL relativa) llegaría a un servidor local si lo hubiera.
apiClient.defaults.adapter = async (config) => {
	throw new Error(
		`Unmocked network request in a test: ${config.method} ${config.url}`,
	);
};

afterEach(() => {
	cleanup();
	window.localStorage.clear();
});

// jsdom no implementa estas APIs que usan algunos componentes.
if (!window.matchMedia) {
	window.matchMedia = ((query: string) => ({
		matches: false,
		media: query,
		addEventListener: () => {},
		removeEventListener: () => {},
		addListener: () => {},
		removeListener: () => {},
		dispatchEvent: () => false,
		onchange: null,
	})) as typeof window.matchMedia;
}
class ResizeObserverStub {
	observe() {}
	unobserve() {}
	disconnect() {}
}
// biome-ignore lint/suspicious/noExplicitAny: stub de una API del navegador ausente en jsdom
(globalThis as any).ResizeObserver ??= ResizeObserverStub;
Element.prototype.scrollIntoView ??= () => {};
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.setPointerCapture ??= () => {};
Element.prototype.releasePointerCapture ??= () => {};
