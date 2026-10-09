import type { ReactNode } from "react";

export function StatBlock({
	label,
	children,
}: {
	label: string;
	children: ReactNode;
}) {
	return (
		<div className="min-w-24">
			<div className="text-[11px] font-medium tracking-wide text-faint uppercase">
				{label}
			</div>
			<div className="mt-0.5 text-lg font-semibold text-foreground tabular-nums">
				{children}
			</div>
		</div>
	);
}
