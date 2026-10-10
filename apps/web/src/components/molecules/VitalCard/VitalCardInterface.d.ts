import type { WebVital } from "@sentinel/shared";

export interface VitalCardProps {
	vital: WebVital;
	p75: number;
	samples: number;
	rating: "good" | "needs-improvement" | "poor";
}
