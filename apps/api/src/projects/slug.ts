import { randomBytes } from "node:crypto";

export function slugify(input: string): string {
	const slug = input
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[̀-ͯ]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 48)
		.replace(/-+$/g, "");
	return slug || "project";
}

export function withSuffix(slug: string): string {
	return `${slug}-${randomBytes(2).toString("hex")}`;
}

export function generatePublicKey(): string {
	return randomBytes(16).toString("hex");
}

// Drizzle envuelve los errores de pg; el código SQLSTATE puede estar en `cause`.
export function isUniqueViolation(error: unknown): boolean {
	const e = error as { code?: string; cause?: { code?: string } };
	return e?.code === "23505" || e?.cause?.code === "23505";
}
