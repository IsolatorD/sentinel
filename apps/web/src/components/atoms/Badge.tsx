import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/utils/cn/cn";

export const badgeVariants = cva(
	"inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
	{
		variants: {
			tone: {
				neutral: "border-border bg-subtle text-muted",
				primary: "border-primary/20 bg-primary-soft text-primary",
				success: "border-success/25 bg-success/10 text-success",
				danger: "border-danger/25 bg-danger/10 text-danger",
				warning: "border-warning/30 bg-warning/10 text-warning",
				info: "border-info/25 bg-info/10 text-info",
				fatal: "border-fatal/25 bg-fatal/10 text-fatal",
			},
		},
		defaultVariants: { tone: "neutral" },
	},
);

export interface BadgeProps
	extends HTMLAttributes<HTMLSpanElement>,
		VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
	return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
