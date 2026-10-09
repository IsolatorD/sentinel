export interface TourStep {
	/** Valor del atributo `data-tour` del elemento que se señala. */
	target: string;
	/** Texto del título y del cuerpo, ya traducidos. */
	title: string;
	body: string;
	side?: "top" | "right" | "bottom" | "left";
}

export interface TourLabels {
	next: string;
	back: string;
	done: string;
	/** Admite `{{current}}` y `{{total}}`. */
	progress: string;
}

export interface StartTourOptions {
	steps: TourStep[];
	labels: TourLabels;
	/** Se llama al terminar el recorrido o cerrarlo (en ambos casos se da por visto). */
	onClose: () => void;
}
