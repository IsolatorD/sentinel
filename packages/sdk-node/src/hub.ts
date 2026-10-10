import type { NodeClient } from "./client";

// El cliente global que usan las funciones de nivel superior (`captureException`, etc.).
let client: NodeClient | undefined;

export function getClient(): NodeClient | undefined {
	return client;
}

export function setClient(next: NodeClient | undefined): void {
	client = next;
}
