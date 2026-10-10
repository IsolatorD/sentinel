export interface RetentionProject {
	id: string;
	retentionDays: number;
}

/** Puerto de borrado por antigüedad (hoy Postgres). Cada método borra como máximo `limit` filas. */
export abstract class RetentionRepository {
	abstract projects(): Promise<RetentionProject[]>;
	/** Issues cuyo último evento es anterior al corte: se van con todos sus eventos y comentarios. */
	abstract deleteStaleIssues(
		projectId: string,
		cutoff: Date,
		limit: number,
	): Promise<number>;
	/** Eventos antiguos de los issues que siguen vivos. */
	abstract deleteOldEvents(
		projectId: string,
		cutoff: Date,
		limit: number,
	): Promise<number>;
	/** Transacciones antiguas (sus spans se borran con ellas). */
	abstract deleteOldTransactions(
		projectId: string,
		cutoff: Date,
		limit: number,
	): Promise<number>;
}
