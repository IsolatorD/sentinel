import { cn } from "@/lib/cn";
import type { CodeLine } from "@/lib/stacktrace";

/** Fragmento de código con números de línea; resalta la que falló. */
export function CodeContext({ lines }: { lines: CodeLine[] }) {
	return (
		<pre
			className="overflow-x-auto border-t border-border bg-surface py-1.5 font-mono text-xs leading-relaxed"
			data-testid="code-context"
		>
			<code className="block min-w-max">
				{lines.map((line) => (
					<span
						key={line.number}
						data-highlight={line.highlight}
						className={cn(
							"flex px-3",
							line.highlight ? "bg-danger/10 text-foreground" : "text-muted",
						)}
					>
						<span className="mr-4 w-8 shrink-0 text-right text-faint select-none">
							{line.number}
						</span>
						<span className="whitespace-pre">{line.text || " "}</span>
					</span>
				))}
			</code>
		</pre>
	);
}
