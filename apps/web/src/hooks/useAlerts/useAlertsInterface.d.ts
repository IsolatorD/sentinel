export interface Scope {
	orgId: string | undefined;
	projectId: string | undefined;
}

export interface ReadyScope {
	orgId: string;
	projectId: string;
}
