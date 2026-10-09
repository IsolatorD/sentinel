/** 1536 -> "1.5 KB". Tamaños de archivo en el idioma del usuario. */
export function formatBytes(bytes: number, locale: string): string {
	const units = ["B", "KB", "MB", "GB"];
	let value = bytes;
	let unit = 0;
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024;
		unit++;
	}
	const number = new Intl.NumberFormat(locale, {
		maximumFractionDigits: unit === 0 ? 0 : 1,
	}).format(value);
	return `${number} ${units[unit]}`;
}
