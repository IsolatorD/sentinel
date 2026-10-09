import { describe, expect, it } from "vitest";
import {
	firesOnEvent,
	frequencyReached,
	passesFilters,
	type RuleCriteria,
	type StoredEvent,
} from "./rule-matching.js";

const rule = (over: Partial<RuleCriteria> = {}): RuleCriteria => ({
	trigger: "new_issue",
	threshold: null,
	windowMinutes: null,
	environment: null,
	minLevel: null,
	...over,
});
const event = (over: Partial<StoredEvent> = {}): StoredEvent => ({
	isNewIssue: false,
	regressed: false,
	level: "error",
	environment: "production",
	...over,
});

describe("passesFilters", () => {
	it("sin filtros deja pasar todo", () => {
		expect(passesFilters(rule(), event())).toBe(true);
		expect(passesFilters(rule(), event({ environment: undefined }))).toBe(true);
	});

	it("el entorno debe coincidir exactamente", () => {
		const r = rule({ environment: "production" });
		expect(passesFilters(r, event({ environment: "production" }))).toBe(true);
		expect(passesFilters(r, event({ environment: "staging" }))).toBe(false);
		expect(passesFilters(r, event({ environment: undefined }))).toBe(false);
		expect(passesFilters(r, event({ environment: "Production" }))).toBe(false);
	});

	it("el nivel mínimo incluye ese nivel y los más graves", () => {
		const r = rule({ minLevel: "error" });
		expect(passesFilters(r, event({ level: "fatal" }))).toBe(true);
		expect(passesFilters(r, event({ level: "error" }))).toBe(true);
		expect(passesFilters(r, event({ level: "warning" }))).toBe(false);
		expect(passesFilters(r, event({ level: "debug" }))).toBe(false);
	});

	it("ambos filtros deben cumplirse", () => {
		const r = rule({ environment: "production", minLevel: "error" });
		expect(passesFilters(r, event({ level: "warning" }))).toBe(false);
		expect(passesFilters(r, event({ environment: "dev" }))).toBe(false);
		expect(passesFilters(r, event())).toBe(true);
	});
});

describe("firesOnEvent", () => {
	it("new_issue solo con un issue nuevo", () => {
		expect(firesOnEvent(rule(), event({ isNewIssue: true }))).toBe(true);
		expect(firesOnEvent(rule(), event({ regressed: true }))).toBe(false);
		expect(firesOnEvent(rule(), event())).toBe(false);
	});

	it("regression solo cuando el evento reabre el issue", () => {
		const r = rule({ trigger: "regression" });
		expect(firesOnEvent(r, event({ regressed: true }))).toBe(true);
		expect(firesOnEvent(r, event({ isNewIssue: true }))).toBe(false);
	});

	it("frequency nunca se dispara por el evento en sí", () => {
		const r = rule({ trigger: "frequency", threshold: 1, windowMinutes: 5 });
		expect(firesOnEvent(r, event({ isNewIssue: true, regressed: true }))).toBe(
			false,
		);
	});
});

describe("frequencyReached", () => {
	const r = rule({ trigger: "frequency", threshold: 10, windowMinutes: 5 });

	it("se alcanza al llegar al umbral, no antes", () => {
		expect(frequencyReached(r, 9)).toBe(false);
		expect(frequencyReached(r, 10)).toBe(true);
		expect(frequencyReached(r, 500)).toBe(true);
	});

	it("solo aplica a reglas de frecuencia con umbral", () => {
		expect(frequencyReached(rule({ threshold: 1 }), 99)).toBe(false);
		expect(frequencyReached(rule({ trigger: "frequency" }), 99)).toBe(false);
	});
});
