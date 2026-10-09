// DSN: <protocolo>://<clavePública>@<host>/<projectId>
// El SDK la descompone y envía los eventos a <protocolo>://<host>/api/<projectId>/events
export function buildDsn(
	publicApiUrl: string,
	publicKey: string,
	projectId: string,
): string {
	const url = new URL(publicApiUrl);
	return `${url.protocol}//${publicKey}@${url.host}/${projectId}`;
}
