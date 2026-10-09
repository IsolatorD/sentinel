export function KeyValueList({
	items,
}: {
	items: Array<{ label: string; value: string | undefined }>;
}) {
	const visible = items.filter((i): i is { label: string; value: string } =>
		Boolean(i.value),
	);
	if (visible.length === 0) return null;
	return (
		<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
			{visible.map(({ label, value }) => (
				<div key={label} className="contents">
					<dt className="text-muted">{label}</dt>
					<dd className="min-w-0 break-words font-mono text-xs leading-5 text-foreground">
						{value}
					</dd>
				</div>
			))}
		</dl>
	);
}
