import { readFileSync } from "node:fs";
import { inject } from "vitest";
import type { SinkMail } from "./smtp-sink.js";

/** Todos los correos que el servidor SMTP de pruebas ha recibido hasta ahora. */
export const mails = (): SinkMail[] =>
	readFileSync(inject("e2e").mailFile, "utf8")
		.split("\n")
		.filter(Boolean)
		.map((line) => JSON.parse(line));
