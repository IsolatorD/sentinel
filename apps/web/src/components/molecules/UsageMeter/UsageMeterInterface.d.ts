export interface UsageMeterProps {
	label: string;
	used: number;
	/** `null`: sin límite (solo se muestra lo consumido). */
	quota: number | null;
}
