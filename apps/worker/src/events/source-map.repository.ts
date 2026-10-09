/**
 * Puerto de acceso a los source maps subidos. Devuelve el JSON del mapa de un archivo minificado
 * de una release, o undefined si no se subió.
 */
export abstract class SourceMapRepository {
	abstract find(
		projectId: string,
		release: string,
		artifactName: string,
	): Promise<string | undefined>;
}
