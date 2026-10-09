import type { ReactNode } from "react";

export interface PageTemplateProps {
	title?: ReactNode;
	description?: string;
	actions?: ReactNode;
	/** Fila bajo el título (pestañas, filtros). */
	toolbar?: ReactNode;
	children: ReactNode;
	/** Contenido más angosto, para formularios y ajustes. */
	narrow?: boolean;
	/** Elemento previo al título (p. ej. el enlace de volver). */
	eyebrow?: ReactNode;
}
