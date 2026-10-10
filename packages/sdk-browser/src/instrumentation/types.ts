import type { Breadcrumb } from "../types";

export type AddBreadcrumb = (crumb: Breadcrumb) => void;
/** Empieza el span de una petición; devuelve `undefined` si no se está midiendo. */
export type StartHttpSpan = (info: { method: string; url: string }) =>
	| {
			headers?: Record<string, string>;
			end: (statusCode?: number) => void;
	  }
	| undefined;
/** Quita la instrumentación y deja todo como estaba. */
export type Uninstall = () => void;
