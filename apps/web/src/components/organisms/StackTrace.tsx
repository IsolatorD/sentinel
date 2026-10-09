import type { ExceptionValue } from "@sentinel/shared";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/atoms/Button/Button";
import { CodeContext } from "@/components/molecules/CodeContext";
import { cn } from "@/utils/cn/cn";
import {
	contextLines,
	framesForDisplay,
	shortLocation,
} from "@/utils/stacktrace/stacktrace";
import type { DisplayFrame } from "@/utils/stacktrace/stacktraceInterface";

/** Un frame; si trae código (source maps), se puede abrir para verlo. */
function FrameRow({
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

function ExceptionBlock({
	value,
	cause,
}: {
	value: ExceptionValue;
	cause?: boolean;
}) {
	const { t } = useTranslation();
	const [showAll, setShowAll] = useState(false);
	const frames = value.stacktrace?.frames ?? [];
	const { frames: shown, hidden } = framesForDisplay(frames, showAll);

	return (
		<div className={cn(cause && "mt-5")} data-testid="exception-block">
			{cause && (
				<div className="mb-1 text-[11px] font-medium tracking-wide text-faint uppercase">
					{t("issue.stackTrace.causedBy")}
				</div>
			)}
			<div className="mb-2">
				<span className="font-mono text-sm font-semibold text-foreground">
					{value.type}
				</span>
				{value.value && (
					<span className="font-mono text-sm text-muted">: {value.value}</span>
				)}
			</div>

			{frames.length === 0 ? (
				<p className="text-sm text-muted">{t("issue.stackTrace.noStack")}</p>
			) : (
				<>
					<ol className="overflow-hidden rounded-md border border-border">
						{shown.map((frame, i) => (
							<FrameRow
								key={frame.index}
								frame={frame}
								// El código del punto donde se lanzó el error viene abierto.
								defaultOpen={i === 0}
							/>
						))}
					</ol>
					{(hidden > 0 || showAll) && frames.some((f) => f.in_app) && (
						<Button
							size="sm"
							variant="ghost"
							className="mt-2"
							onClick={() => setShowAll((v) => !v)}
						>
							{showAll
								? t("issue.stackTrace.inAppOnly")
								: t("issue.stackTrace.showAll", { count: hidden })}
						</Button>
					)}
				</>
			)}
		</div>
	);
}

/**
 * `exceptions` llega con la causa más profunda primero y la excepción principal al final.
 * En pantalla se muestra primero la principal y después sus causas.
 */
export function StackTrace({ exceptions }: { exceptions: ExceptionValue[] }) {
	const ordered = [...exceptions].reverse();
	return (
		<div>
			{ordered.map((value, i) => (
				<ExceptionBlock
					// biome-ignore lint/suspicious/noArrayIndexKey: lista inmutable derivada del evento; las excepciones no tienen id propio
					key={`${value.type}-${i}`}
					value={value}
					cause={i > 0}
				/>
			))}
		</div>
	);
}
