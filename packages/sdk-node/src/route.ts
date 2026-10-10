const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LONG_HEX = /^[0-9a-f]{16,}$/i;
const NUMERIC = /^\d+$/;

/**
 * `/users/42/orders/9f1d…` -> `/users/:id/orders/:id`. Sin esto cada id sería una transacción distinta
 * y la lista de rendimiento se llenaría de miles de filas casi idénticas.
 */
export function normalizePath(pathname: string): string {
	return (
		pathname
			.split("/")
			.map((segment) =>
				NUMERIC.test(segment) || UUID.test(segment) || LONG_HEX.test(segment)
					? ":id"
					: segment,
			)
			.join("/") || "/"
	);
}
