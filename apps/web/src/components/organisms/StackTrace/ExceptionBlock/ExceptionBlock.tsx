import type { ExceptionValue } from "@sentinel/shared";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/atoms/Button/Button";
import { FrameRow } from "@/components/organisms/StackTrace/ExceptionBlock/FrameRow/FrameRow";
import { cn } from "@/utils/cn/cn";
import { framesForDisplay } from "@/utils/stacktrace/stacktrace";

export function ExceptionBlock({
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
								index={i}
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
