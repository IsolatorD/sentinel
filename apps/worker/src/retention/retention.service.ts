import { Injectable, Logger } from "@nestjs/common";
import {
	emptyStats,
	type RetentionStats,
	retentionCutoff,
} from "./retention.domain.js";
import { RetentionRepository } from "./retention.repository.js";

/** Filas por sentencia de borrado: pocas para no bloquear, y las transacciones arrastran sus spans. */
const BATCH = 2_000;
/** Tope de lotes por tabla y proyecto en una pasada: la siguiente (mañana) sigue donde se quedó. */
const MAX_BATCHES = 500;

@Injectable()
export class RetentionService {
	private readonly logger = new Logger(RetentionService.name);

	constructor(private readonly repository: RetentionRepository) {}

	/** Aplica la retención de todos los proyectos. Un proyecto que falla no impide el resto. */
	async run(now = new Date()): Promise<RetentionStats> {
		const total = emptyStats();
		for (const project of await this.repository.projects()) {
			try {
				const cutoff = retentionCutoff(now, project.retentionDays);
				total.issues += await this.drain((n) =>
					this.repository.deleteStaleIssues(project.id, cutoff, n),
				);
				total.events += await this.drain((n) =>
					this.repository.deleteOldEvents(project.id, cutoff, n),
				);
				total.transactions += await this.drain((n) =>
					this.repository.deleteOldTransactions(project.id, cutoff, n),
				);
				total.projects++;
			} catch (error) {
				this.logger.error(
					`retención del proyecto ${project.id} falló: ${String(error)}`,
				);
			}
		}
		this.logger.log(
			`retención: ${total.projects} proyectos, ${total.issues} issues, ${total.events} eventos y ${total.transactions} transacciones borrados`,
		);
		return total;
	}

	private async drain(deleteBatch: (limit: number) => Promise<number>) {
		let total = 0;
		for (let i = 0; i < MAX_BATCHES; i++) {
			const deleted = await deleteBatch(BATCH);
			total += deleted;
			if (deleted < BATCH) break;
		}
		return total;
	}
}
