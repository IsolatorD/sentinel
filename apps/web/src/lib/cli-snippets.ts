export interface UploadSnippetInput {
	apiUrl: string;
	orgId: string;
	projectId: string;
	release: string;
}

/** Comando para subir los source maps de un build; el token va en una variable, nunca en el texto. */
export function sourceMapsUploadSnippet(input: UploadSnippetInput): string {
	const quote = (v: string) => `'${v.replaceAll("'", "'\\''")}'`;
	return [
		`export SENTINEL_URL=${quote(input.apiUrl)}`,
		"export SENTINEL_AUTH_TOKEN=<your-api-token>",
		`export SENTINEL_ORG=${quote(input.orgId)}`,
		`export SENTINEL_PROJECT=${quote(input.projectId)}`,
		"",
		`sentinel-cli sourcemaps upload ./dist --release ${quote(input.release)}`,
	].join("\n");
}
