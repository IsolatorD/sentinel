import { cn } from "@/lib/cn";

const PALETTE = [
	"#6c5fc7",
	"#3d74db",
	"#2ba185",
	"#d98b00",
	"#e03e52",
	"#7b2d8e",
	"#0e8fa8",
];

function colorFor(seed: string): string {
	let hash = 0;
	for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
	return PALETTE[hash % PALETTE.length];
}

function initials(name: string): string {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return "?";
	if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
	return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({
	name,
	className,
	rounded = "md",
}: {
	name: string;
	className?: string;
	rounded?: "md" | "full";
}) {
	return (
		<span
			aria-hidden
			style={{ backgroundColor: colorFor(name) }}
			className={cn(
				"inline-flex size-7 shrink-0 items-center justify-center text-[11px] font-semibold text-white",
				rounded === "full" ? "rounded-full" : "rounded-md",
				className,
			)}
		>
			{initials(name)}
		</span>
	);
}
