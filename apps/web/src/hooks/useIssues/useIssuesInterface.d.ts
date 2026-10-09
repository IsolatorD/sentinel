export interface Scope {
	orgId: string | undefined;
	projectId: string | undefined;
}

/** Alcance ya resuelto (organización y proyecto conocidos). */
export interface ReadyScope {
	orgId: string;
	projectId: string;
}
