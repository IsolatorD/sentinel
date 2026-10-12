export interface SidebarProps {
	/** Modo mini: solo iconos (escritorio). */
	collapsed?: boolean;
	/** Pliega o despliega la barra; sin esto (menú móvil) no se muestra el botón. */
	onToggleCollapsed?: () => void;
}
