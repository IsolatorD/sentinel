import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";

export const STYLES = {
	error: { box: "border-danger/30 bg-danger/5 text-danger", Icon: AlertCircle },
	success: {
		box: "border-success/30 bg-success/10 text-success",
		Icon: CheckCircle2,
	},
	info: { box: "border-info/30 bg-info/5 text-info", Icon: Info },
	warning: {
		box: "border-warning/40 bg-warning/10 text-warning",
		Icon: AlertTriangle,
	},
} as const;
