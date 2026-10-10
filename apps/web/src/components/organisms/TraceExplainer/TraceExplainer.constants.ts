import { Database, Globe, Server } from "lucide-react";

/** Los tres tramos del recorrido de ejemplo: navegador, API y base de datos. */
export const NODES = [
	{ id: "browser", icon: Globe },
	{ id: "api", icon: Server },
	{ id: "db", icon: Database },
] as const;

/** Lo que aporta tener la traza completa (`landing.traces.items.<id>`). */
export const ITEMS = ["link", "waterfall", "errors"] as const;
