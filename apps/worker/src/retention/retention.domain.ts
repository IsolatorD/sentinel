const DAY_MS = 86_400_000;

/** Lo anterior a esta fecha ya no se conserva. */
export function retentionCutoff(now: Date, retentionDays: number): Date {
	return new Date(now.getTime() - retentionDays * DAY_MS);
}

export interface RetentionStats {
	projects: number;
	issues: number;
	events: number;
	transactions: number;
}

export const emptyStats = (): RetentionStats => ({
	projects: 0,
	issues: 0,
	events: 0,
	transactions: 0,
});
