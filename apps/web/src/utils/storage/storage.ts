// localStorage puede no existir o lanzar (modo privado, datos bloqueados): nunca debe romper la app.
export function readStorage(key: string): string | null {
	try {
		return window.localStorage.getItem(key);
	} catch {
		return null;
	}
}

export function writeStorage(key: string, value: string): void {
	try {
		window.localStorage.setItem(key, value);
	} catch {
		// Sin persistencia: la app sigue funcionando.
	}
}

export function removeStorage(key: string): void {
	try {
		window.localStorage.removeItem(key);
	} catch {
		// Sin persistencia: no hay nada que borrar.
	}
}
