import type { ReactNode } from "react";

export interface PublicTemplateProps {
	children: ReactNode;
	/** Contenido del botón de la barra: dónde está la persona (resalta su enlace). */
	active?: "home" | "docs";
}
