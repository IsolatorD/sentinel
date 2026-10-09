import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// driver.js se simula: aquí se comprueba qué pasos se le pasan, no cómo los dibuja.
const driveMock = vi.fn();
const optionsSeen: Array<Record<string, unknown>> = [];
let activeFlag = false;
vi.mock("driver.js", () => ({
	driver: (options: Record<string, unknown>) => {
		optionsSeen.push(options);
		return {
			drive: () => {
				activeFlag = true;
				driveMock();
			},
			isActive: () => activeFlag,
		};
	},
}));

import { isTourEnabled, startTour } from "./tour";

const labels = {
	next: "Next",
	back: "Back",
	done: "Done",
	progress: "{{current}} of {{total}}",
};
const step = (target: string) => ({
	target,
	title: `t-${target}`,
	body: `b-${target}`,
});

/** jsdom no calcula layout: se simula que el elemento ocupa espacio. */
function addTarget(name: string, visible = true) {
	const el = document.createElement("div");
	el.setAttribute("data-tour", name);
	el.getClientRects = () =>
		visible ? ([{}] as unknown as DOMRectList) : ([] as unknown as DOMRectList);
	document.body.append(el);
}

beforeEach(() => {
	driveMock.mockClear();
	optionsSeen.length = 0;
	activeFlag = false;
	window.matchMedia ??= (() => ({
		matches: false,
	})) as unknown as typeof window.matchMedia;
});
afterEach(() => {
	document.body.innerHTML = "";
	vi.unstubAllEnvs();
});

describe("startTour", () => {
	it("muestra solo los pasos cuyo elemento está en pantalla", () => {
		addTarget("a");
		addTarget("b", false); // escondido
		const started = startTour({
			steps: [step("a"), step("b"), step("c")],
			labels,
			onClose: vi.fn(),
		});
		expect(started).toBe(true);
		const steps = optionsSeen[0].steps as Array<{
			element: string;
			popover: { title: string };
		}>;
		expect(steps.map((s) => s.element)).toEqual(['[data-tour="a"]']);
		expect(steps[0].popover.title).toBe("t-a");
		expect(driveMock).toHaveBeenCalledTimes(1);
	});

	it("si no hay ningún paso visible, no muestra nada", () => {
		const onClose = vi.fn();
		expect(startTour({ steps: [step("nada")], labels, onClose })).toBe(false);
		expect(driveMock).not.toHaveBeenCalled();
		expect(onClose).not.toHaveBeenCalled();
	});

	it("solo se muestra un recorrido a la vez", () => {
		addTarget("a");
		expect(startTour({ steps: [step("a")], labels, onClose: vi.fn() })).toBe(
			true,
		);
		expect(startTour({ steps: [step("a")], labels, onClose: vi.fn() })).toBe(
			false,
		);
		expect(driveMock).toHaveBeenCalledTimes(1);
	});

	it("pasa los textos traducidos y avisa al cerrarse", () => {
		addTarget("a");
		addTarget("b");
		const onClose = vi.fn();
		startTour({ steps: [step("a"), step("b")], labels, onClose });
		const options = optionsSeen[0] as {
			nextBtnText: string;
			doneBtnText: string;
			progressText: string;
			showProgress: boolean;
			onDestroyed: () => void;
		};
		expect(options).toMatchObject({
			nextBtnText: "Next",
			doneBtnText: "Done",
			progressText: "{{current}} of {{total}}",
			showProgress: true,
		});
		options.onDestroyed();
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("con un solo paso no muestra el progreso", () => {
		addTarget("a");
		startTour({ steps: [step("a")], labels, onClose: vi.fn() });
		expect((optionsSeen[0] as { showProgress: boolean }).showProgress).toBe(
			false,
		);
	});

	it("respeta 'reducir movimiento' del sistema", () => {
		addTarget("a");
		vi.spyOn(window, "matchMedia").mockReturnValue({
			matches: true,
		} as MediaQueryList);
		startTour({ steps: [step("a")], labels, onClose: vi.fn() });
		expect(optionsSeen[0]).toMatchObject({
			animate: false,
			smoothScroll: false,
		});
	});
});

describe("isTourEnabled", () => {
	it("está apagado en las pruebas y encendido en uso normal", () => {
		expect(isTourEnabled()).toBe(false);
		vi.stubEnv("MODE", "production");
		expect(isTourEnabled()).toBe(true);
	});
});
