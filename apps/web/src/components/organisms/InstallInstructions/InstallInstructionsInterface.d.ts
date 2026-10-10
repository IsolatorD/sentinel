export type Method = "npm" | "pip" | "script" | "http";

export interface InstallInstructionsProps {
	dsn: string;
	/** Plataforma del proyecto; decide qué instrucciones se muestran. */
	platform?: string;
}
