/** Better Auth guarda los roles como texto; varios roles van separados por coma. */
export function isAdminRole(role: string): boolean {
	return role.split(",").some((r) => ["owner", "admin"].includes(r.trim()));
}
