import type { DeliveryStatus } from "@sentinel/shared";

export const TONES: Record<DeliveryStatus, "info" | "success" | "danger"> = {
	pending: "info",
	sent: "success",
	failed: "danger",
};
