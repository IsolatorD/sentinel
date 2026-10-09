export function TagPill({ name, value }: { name: string; value: string }) {
	return (
		<span className="inline-flex max-w-full overflow-hidden rounded border border-border bg-subtle text-xs">
			<span className="border-r border-border px-1.5 py-0.5 text-muted">
				{name}
			</span>
			<span className="truncate px-1.5 py-0.5 font-mono text-foreground">
				{value}
			</span>
		</span>
	);
}
