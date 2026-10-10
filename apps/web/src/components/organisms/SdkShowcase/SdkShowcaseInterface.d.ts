export interface SdkEntry {
	id: "javascript" | "react" | "node" | "python" | "react-native";
	label: string;
	/** Comando de instalación y código de configuración. */
	snippet: { install: string; code: string };
	/** Lo que mide el SDK (claves en `landing.sdks.<id>`). */
	language: string;
}
