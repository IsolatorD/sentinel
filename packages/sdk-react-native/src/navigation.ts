import { getClient } from "./hub";

/**
 * Lo que se necesita de un contenedor de navegación (React Navigation `NavigationContainer` con
 * `createNavigationContainerRef`, o Expo Router): sin importar la biblioteca.
 */
export interface NavigationContainerLike {
	addListener(
		event: "state",
		listener: () => void,
	): (() => void) | { remove(): void } | undefined;
	getCurrentRoute?(): { name: string } | undefined;
}

/**
 * Registra los cambios de pantalla: un breadcrumb por cambio y una transacción `navigation` por pantalla
 * (la anterior termina al llegar la nueva). La primera pantalla da por terminado el arranque de la app.
 *
 *     <NavigationContainer ref={navigationRef} onReady={() => Sentinel.instrumentNavigation(navigationRef)}>
 *
 * Devuelve la función para dejar de escuchar.
 */
export function instrumentNavigation(
	container: NavigationContainerLike,
): () => void {
	let last: string | undefined;

	const onChange = () => {
		const client = getClient();
		const name = container.getCurrentRoute?.()?.name;
		if (!client || !name || name === last) return;
		if (client.crumbs.navigation)
			client.addBreadcrumb({
				category: "navigation",
				type: "navigation",
				data: { from: last ?? null, to: name },
			});
		last = name;
		client.appReady();
		client.startNavigationTransaction(name);
	};

	const subscription = container.addListener("state", onChange);
	// El contenedor puede estar ya listo: se registra la pantalla actual.
	onChange();
	return () => {
		if (typeof subscription === "function") subscription();
		else subscription?.remove();
	};
}
