export interface BreakdownItem {
	key: string;
	count: number;
}

export interface BreakdownCardProps {
	title: string;
	items: BreakdownItem[];
	/** Cómo se muestra cada clave (traducir un nivel, "sin dato"...). */
	labelOf: (key: string) => string;
	/** Clase de color de la barra de cada clave. */
	colorOf?: (key: string) => string;
	testId?: string;
}
