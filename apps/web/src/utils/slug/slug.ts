/** Mismo criterio que usa el backend para los slugs de proyecto. */
export function slugify(input: string): string {
	return (
		input
			.toLowerCase()
			.normalize("NFKD")
			.replace(/[̀-ͯ]/g, "")
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "")
			.slice(0, 48)
			.replace(/-+$/g, "") || "org"
	);
}

/** Slug único para una organización: el nombre más un sufijo aleatorio corto. */
export function uniqueSlug(name: string): string {
	const suffix = Math.random().toString(36).slice(2, 6);
	return `${slugify(name)}-${suffix}`;
}
