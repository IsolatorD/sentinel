import {
	Bell,
	Bug,
	Gauge,
	GitBranch,
	Map as MapIcon,
	Route,
	ShieldCheck,
	Users,
} from "lucide-react";

/** Las funciones que presenta la landing, en orden. El texto está en `landing.features.<id>`. */
export const FEATURES = [
	{ id: "errors", icon: Bug },
	{ id: "performance", icon: Gauge },
	{ id: "traces", icon: Route },
	{ id: "sourcemaps", icon: MapIcon },
	{ id: "alerts", icon: Bell },
	{ id: "releases", icon: GitBranch },
	{ id: "teams", icon: Users },
	{ id: "privacy", icon: ShieldCheck },
] as const;
