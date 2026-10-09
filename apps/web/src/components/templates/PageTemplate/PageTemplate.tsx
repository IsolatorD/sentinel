import type { PageTemplateProps } from "@/components/templates/PageTemplate/PageTemplateInterface";
import { cn } from "@/utils/cn/cn";

export function PageTemplate({
	title,
	description,
	actions,
	toolbar,
	children,
	narrow,
	eyebrow,
}: PageTemplateProps) {
	return (
		<div
			className={cn(
				"mx-auto w-full px-6 py-6",
				narrow ? "max-w-3xl" : "max-w-6xl",
			)}
		>
			{eyebrow && <div className="mb-3">{eyebrow}</div>}
			{(title || actions) && (
				<div className="mb-5 flex flex-wrap items-start justify-between gap-3">
					<div className="min-w-0">
						{title && (
							<h1 className="text-xl font-semibold text-foreground">{title}</h1>
						)}
						{description && (
							<p className="mt-1 text-sm text-muted">{description}</p>
						)}
					</div>
					{actions && (
						<div className="flex shrink-0 items-center gap-2">{actions}</div>
					)}
				</div>
			)}
			{toolbar && <div className="mb-4">{toolbar}</div>}
			{children}
		</div>
	);
}
