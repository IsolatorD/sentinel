export const LEVEL_BAR: Record<string, string> = {
	fatal: "bg-fatal",
	error: "bg-error",
	warning: "bg-warning",
	info: "bg-info",
	debug: "bg-debug",
};

/**
 * Columnas compartidas con la cabecera de la lista. Solo desde `@2xl` (ancho de la tarjeta de la lista, no de la ventana): en pantallas estrechas cada
 * issue es una tarjeta (ver `IssueListItem`) y la cabecera de columnas no se muestra.
 */
export const ISSUE_GRID =
	"@2xl:grid @2xl:grid-cols-[minmax(0,1fr)_5rem_4rem_4rem_6rem] @2xl:items-center @2xl:gap-3";
