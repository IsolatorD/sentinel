import { cn } from "@/lib/cn";

/** Marca de Sentinel: un escudo con un punto de alerta. */
export function LogoMark({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 32 32" aria-hidden className={cn("size-7", className)}>
			<title>Sentinel</title>
			<path
				d="M16 2.5 5 6.8v8.1c0 6.6 4.5 11.5 11 14.6 6.5-3.1 11-8 11-14.6V6.8L16 2.5Z"
				fill="currentColor"
				opacity="0.18"
			/>
			<path
				d="M16 2.5 5 6.8v8.1c0 6.6 4.5 11.5 11 14.6 6.5-3.1 11-8 11-14.6V6.8L16 2.5Z"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinejoin="round"
			/>
			<path
				d="M16 9.5v8"
				stroke="currentColor"
				strokeWidth="2.4"
				strokeLinecap="round"
			/>
			<circle cx="16" cy="21.5" r="1.7" fill="currentColor" />
		</svg>
	);
}

export function Logo({
	className,
	markClassName,
}: {
	className?: string;
	markClassName?: string;
}) {
	return (
		<span
			className={cn(
				"inline-flex items-center gap-2 font-semibold tracking-tight",
				className,
			)}
		>
			<LogoMark className={markClassName} />
			<span>Sentinel</span>
		</span>
	);
}
