import type { IngestEvent } from "@sentinel/shared";

/** El payload guardado es el evento validado más los datos del cliente que añade el servidor. */
export type EventView = IngestEvent & {
	_client?: { ip?: string; userAgent?: string };
};
