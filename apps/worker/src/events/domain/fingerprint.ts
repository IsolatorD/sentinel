import { createHash } from "node:crypto";
import type { ExceptionValue, IngestEvent, StackFrame } from "@sentinel/shared";

export interface EventAnalysis {
	fingerprint: string;
	title: string;
	culprit?: string;
	type: string;
}

const MAX_FRAMES_IN_FINGERPRINT = 10;
const MAX_TITLE_LENGTH = 200;

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const HEX_PREFIXED = /0x[0-9a-f]+/gi;
const LONG_HEX = /\b[0-9a-f]{8,}\b/gi;
const NUMBER = /\d+(?:\.\d+)?/g;

function firstLine(text: string): string {
	return text.split("\n", 1)[0].trim();
}

/** Quita lo variable (ids, números) para que "Error 1234" y "Error 5678" agrupen. */
export function normalizeMessage(message: string): string {
	return firstLine(message)
		.replace(UUID, "<uuid>")
		.replace(HEX_PREFIXED, "<hex>")
		.replace(LONG_HEX, "<hex>")
		.replace(NUMBER, "<num>");
}

/** Quita host, query y el hash de bundler (main.3f2a1b9c.js -> main.js). */
export function normalizeFilename(filename = ""): string {
	const normalized = filename
		.split(/[?#]/, 1)[0]
		.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, "")
		.replace(/([.-])[0-9a-f]{8,}(?=\.[a-z0-9]+$)/i, "");
	return normalized || "<unknown>";
}

function frameKey(frame: StackFrame): string {
	const file = normalizeFilename(frame.module ?? frame.filename);
	return `${file}:${frame.function ?? "?"}`;
}

// Los frames "in_app" son del código del usuario; si no hay ninguno, usamos todos.
function relevantFrames(frames: StackFrame[]): StackFrame[] {
	const inApp = frames.filter((f) => f.in_app);
	const chosen = inApp.length > 0 ? inApp : frames;
	return chosen.slice(-MAX_FRAMES_IN_FINGERPRINT);
}

function hash(parts: string[]): string {
	return createHash("sha256")
		.update(parts.join("\n"))
		.digest("hex")
		.slice(0, 32);
}

function truncate(text: string): string {
	return text.length > MAX_TITLE_LENGTH
		? `${text.slice(0, MAX_TITLE_LENGTH - 1)}…`
		: text;
}

function culpritOf(main: ExceptionValue): string | undefined {
	const frames = main.stacktrace?.frames ?? [];
	const frame = [...frames].reverse().find((f) => f.in_app) ?? frames.at(-1);
	if (!frame) return undefined;
	const file = normalizeFilename(frame.filename).split("/").pop();
	const line = frame.lineno !== undefined ? `:${frame.lineno}` : "";
	return `${frame.function ?? "<anonymous>"} (${file}${line})`;
}

/**
 * Calcula el fingerprint (clave de agrupación), el título y el culprit de un evento.
 * Orden de prioridad:
 *  1. fingerprint personalizado enviado por el SDK
 *  2. excepción con stacktrace: tipo + frames relevantes (sin mensaje ni números de línea)
 *  3. excepción sin stacktrace: tipo + mensaje normalizado
 *  4. evento de mensaje: mensaje normalizado
 */
export function analyzeEvent(event: IngestEvent): EventAnalysis {
	const main = event.exception?.values.at(-1);

	const type = main?.type ?? "message";
	const title = main
		? truncate(
				main.value ? `${main.type}: ${firstLine(main.value)}` : main.type,
			)
		: truncate(firstLine(event.message ?? "") || "<unlabeled event>");
	const culprit = main ? culpritOf(main) : undefined;

	let parts: string[];
	if (event.fingerprint) {
		parts = ["custom", ...event.fingerprint];
	} else if (main?.stacktrace && main.stacktrace.frames.length > 0) {
		parts = [
			"exception",
			main.type,
			...relevantFrames(main.stacktrace.frames).map(frameKey),
		];
	} else if (main) {
		parts = ["exception", main.type, normalizeMessage(main.value ?? "")];
	} else {
		parts = ["message", normalizeMessage(event.message ?? "")];
	}

	return { fingerprint: hash(parts), title, culprit, type };
}

/** ISO u epoch (segundos o ms). Valores inválidos o futuros caen a la hora de recepción. */
export function parseEventTimestamp(
	raw: string | number | undefined,
	receivedAt: Date,
): Date {
	if (raw === undefined) return receivedAt;
	const date =
		typeof raw === "number"
			? new Date(raw > 1e11 ? raw : raw * 1000)
			: new Date(raw);
	if (Number.isNaN(date.getTime())) return receivedAt;
	const tolerance = 5 * 60 * 1000;
	return date.getTime() > receivedAt.getTime() + tolerance ? receivedAt : date;
}
