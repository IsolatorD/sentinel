export const LAST_ORG_KEY = "sentinel:last-org";

/** `"1"` si la barra lateral se dejó en modo mini. */
export const SIDEBAR_COLLAPSED_KEY = "sentinel:sidebar-collapsed";

/** Clave con la que se recuerda que una persona ya vio un recorrido guiado. */
export const tourSeenKey = (userId: string, tourId: string) =>
	`sentinel:tour:${userId}:${tourId}`;
