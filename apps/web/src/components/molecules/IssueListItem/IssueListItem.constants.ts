export const LEVEL_BAR: Record<string, string> = {
	fatal: "bg-fatal",
	error: "bg-error",
	warning: "bg-warning",
	info: "bg-info",
	debug: "bg-debug",
};

/**
 * Columnas compartidas con la cabecera de la lista. Solo desde `md`: en pantallas estrechas cada
 * issue es una tarjeta (ver `IssueListItem`) y la cabecera de columnas no se muestra.
 */
export const ISSUE_GRID =
	"md:grid md:grid-cols-[minmax(0,1fr)_6rem_4.5rem_4.5rem_7rem] md:items-center md:gap-4";
