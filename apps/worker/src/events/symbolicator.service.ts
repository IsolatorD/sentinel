import { TraceMap } from "@jridgewell/trace-mapping";
import { Injectable, Logger } from "@nestjs/common";
import type { IngestEvent } from "@sentinel/shared";
import { symbolicateEvent } from "./domain/symbolicate.js";
import { TtlCache } from "./domain/ttl-cache.js";
import { SourceMapRepository } from "./source-map.repository.js";

// Parsear un mapa cuesta; se reutiliza entre eventos de la misma release. Los "no hay mapa" se
// recuerdan poco tiempo para no consultar la base por cada evento, pero sin esconder por mucho
// rato un mapa que se acaba de subir.
const FOUND_TTL_MS = 5 * 60_000;
const MISSING_TTL_MS = 15_000;

@Injectable()
export class SymbolicatorService {
	private readonly logger = new Logger(SymbolicatorService.name);
	private readonly cache = new TtlCache<TraceMap | null>(100);

	constructor(private readonly maps: SourceMapRepository) {}

	/** Devuelve el evento con los frames simbolizados; ante cualquier fallo, el original. */
	async symbolicate(
		projectId: string,
		event: IngestEvent,
	): Promise<IngestEvent> {
		const release = event.release;
		if (!release || !event.exception) return event;
		try {
			return await symbolicateEvent(event, (name) =>
				this.load(projectId, release, name),
			);
		} catch (error) {
			this.logger.warn(`No se pudo simbolizar el evento: ${String(error)}`);
			return event;
		}
	}

	private async load(
		projectId: string,
		release: string,
		name: string,
	): Promise<TraceMap | undefined> {
		const key = `${projectId}|${release}|${name}`;
		const cached = this.cache.get(key);
		if (cached) return cached.value ?? undefined;

		let map: TraceMap | null = null;
		try {
			const json = await this.maps.find(projectId, release, name);
			map = json ? new TraceMap(json) : null;
		} catch (error) {
			// Un mapa corrupto no debe tumbar el procesamiento; se reintenta pronto.
			this.logger.warn(
				`Source map inválido (${name}, ${release}): ${String(error)}`,
			);
		}
		this.cache.set(key, map, map ? FOUND_TTL_MS : MISSING_TTL_MS);
		return map ?? undefined;
	}
}
