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
