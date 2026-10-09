/** El owner no se puede degradar ni quitar desde aquí: eso es traspasar o borrar la organización. */
export const LOCKED_ROLE = "owner";

export const isAdminRole = (role: string): boolean =>
	role.split(",").some((r) => ["owner", "admin"].includes(r.trim()));
