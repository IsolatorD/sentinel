import type { RNClient } from "./client";

// El cliente global que usan las funciones de nivel superior.
let client: RNClient | undefined;

export function getClient(): RNClient | undefined {
	return client;
}

export function setClient(next: RNClient | undefined): void {
	client = next;
}
