export const LAST_ORG_KEY = "sentinel:last-org";

/** Clave con la que se recuerda que una persona ya vio un recorrido guiado. */
export const tourSeenKey = (userId: string, tourId: string) =>
	`sentinel:tour:${userId}:${tourId}`;
