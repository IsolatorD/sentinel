/** Cabeceras de una respuesta: el objeto de axios o un objeto plano. */
export type HeaderBag =
	| { get?: (name: string) => unknown }
	| Record<string, unknown>;
