import type { IngestEvent } from "@sentinel/shared";
import type { EventAnalysis } from "./domain/fingerprint.js";

/** Evento ya analizado, listo para persistir. */
export interface NewEvent {
	id: string;
	projectId: string;
	timestamp: Date;
	receivedAt: Date;
	analysis: EventAnalysis;
	level: string;
	message?: string;
	release?: string;
	environment?: string;
	platform?: string;
	userIdentifier?: string;
	/** Traza de la transacción en curso al capturar el evento, si la había. */
	traceId?: string;
	payload: IngestEvent & { _client: { ip?: string; userAgent?: string } };
}

export interface SaveResult {
	eventId: string;
	issueId?: string;
	isNewIssue: boolean;
	/** El evento reabrió un issue resuelto (regresión por release). */
	regressed: boolean;
	/** El evento ya existía (reintento de un job): no se contó dos veces. */
	duplicate: boolean;
}

/**
 * Puerto de persistencia de eventos e issues. Hoy lo implementa Postgres
 * (DrizzleEventRepository); si el volumen lo exige, un almacén columnar
 * (p. ej. ClickHouse) puede reemplazarlo sin tocar la lógica de agrupación.
 */
export abstract class EventRepository {
	/**
	 * Agrupa el evento en un issue (lo crea si no existe) y guarda el evento.
	 * Debe ser atómico e idempotente respecto de `event.id`.
	 */
	abstract save(event: NewEvent): Promise<SaveResult>;
}
