import type { EmptyStateProps } from "@/components/molecules/EmptyState/EmptyStateInterface";

export function EmptyState({
	icon: Icon,
	title,
	description,
	action,
}: EmptyStateProps) {
	return (
		<div className="flex flex-col items-center px-6 py-16 text-center">
			<span className="mb-4 flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
				<Icon aria-hidden className="size-6" />
			</span>
			<h3 className="text-base font-semibold text-foreground">{title}</h3>
			{description && (
				<p className="mt-1 max-w-md text-sm text-muted">{description}</p>
			)}
			{action && <div className="mt-5">{action}</div>}
		</div>
	);
}
