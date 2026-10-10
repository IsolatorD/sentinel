export type Method = "npm" | "script" | "http";

export interface InstallInstructionsProps {
	dsn: string;
	/** Plataforma del proyecto; decide qué instrucciones se muestran. */
	platform?: string;
}
