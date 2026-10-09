import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CodeContext } from "@/components/molecules/CodeContext/CodeContext";
import { cn } from "@/utils/cn/cn";
import { contextLines, shortLocation } from "@/utils/stacktrace/stacktrace";
import type { DisplayFrame } from "@/utils/stacktrace/stacktraceInterface";

/** Un frame; si trae código (source maps), se puede abrir para verlo. */
export function FrameRow({
	frame,
	defaultOpen,
}: {
	frame: DisplayFrame;
	defaultOpen: boolean;
}) {
	const { t } = useTranslation();
	const code = contextLines(frame);
	const [open, setOpen] = useState(defaultOpen);
	const title = frame.abs_path ?? frame.filename;

	const label = (
		<>
			<span title={title} className="font-semibold">
				{shortLocation(frame)}
			</span>{" "}
			{frame.function && (
				<span>
					<span className="text-faint">in </span>
					<span className={frame.in_app ? "text-primary" : ""}>
						{frame.function}
					</span>
				</span>
			)}
		</>
	);

	return (
		<li
			data-in-app={frame.in_app ? "true" : "false"}
			className={cn(
				"border-b border-border border-l-[3px] font-mono text-xs last:border-b-0",
				frame.in_app
					? "border-l-primary bg-primary-soft/40 text-foreground"
					: "border-l-transparent bg-subtle/40 text-muted",
			)}
		>
			{code.length > 0 ? (
				<button
					type="button"
					aria-expanded={open}
					aria-label={`${t(open ? "issue.stackTrace.hideCode" : "issue.stackTrace.showCode")}: ${shortLocation(frame)}`}
					onClick={() => setOpen((v) => !v)}
					className="flex w-full flex-wrap items-baseline gap-x-2 px-3 py-1.5 text-left hover:bg-primary-soft/60"
				>
					<ChevronRight
						aria-hidden
						className={cn(
							"size-3 shrink-0 self-center transition-transform",
							open && "rotate-90",
						)}
					/>
					<span>{label}</span>
				</button>
			) : (
				<div className="flex flex-wrap items-baseline gap-x-2 px-3 py-1.5">
					<span>{label}</span>
				</div>
			)}
			{open && code.length > 0 && <CodeContext lines={code} />}
		</li>
	);
}
