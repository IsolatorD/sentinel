import type { CodeBlockProps } from "@/components/molecules/CodeBlock/CodeBlockInterface";
import { CopyButton } from "@/components/molecules/CopyButton/CopyButton";
import { cn } from "@/utils/cn/cn";

export function CodeBlock({ code, title, className }: CodeBlockProps) {
	return (
		<div
			className={cn(
				"overflow-hidden rounded-md border border-border bg-[#2b2233]",
				className,
			)}
		>
			<div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5">
				<span className="text-xs text-sidebar-muted">{title}</span>
				<CopyButton
					value={code}
					className="border-white/15 bg-transparent text-sidebar-text hover:bg-white/10"
				/>
			</div>
			<pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed text-[#e6e0ee]">
				<code>{code}</code>
			</pre>
		</div>
	);
}
