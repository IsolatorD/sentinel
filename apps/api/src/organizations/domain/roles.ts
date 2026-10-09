export type OrgRole = "owner" | "admin" | "member";
export type AccessLevel = "member" | "admin";

// Better Auth guarda los roles como texto; varios roles van separados por coma.
export function parseRoles(raw: string): OrgRole[] {
	return raw
		.split(",")
		.map((r) => r.trim())
		.filter((r): r is OrgRole => ["owner", "admin", "member"].includes(r));
}

/**
 * - "member": cualquier miembro de la organización.
 * - "admin": solo owner o admin.
 */
export function canAccess(rawRole: string, level: AccessLevel): boolean {
	if (level === "member") return true;
	return parseRoles(rawRole).some((r) => r === "owner" || r === "admin");
}
