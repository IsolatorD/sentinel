import type { ReactNode } from "react";

export interface StatTileProps {
	label: string;
	children: ReactNode;
	/** Variación en % respecto al periodo anterior; `null`/ausente = sin base para comparar. */
	change?: number | null;
	/** Si subir es malo (errores, issues nuevos): la subida se pinta en rojo y la bajada en verde. */
	upIsBad?: boolean;
	hint?: string;
}
