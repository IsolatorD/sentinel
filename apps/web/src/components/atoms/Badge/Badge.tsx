import { badgeVariants } from "@/components/atoms/Badge/Badge.constants";
import type { BadgeProps } from "@/components/atoms/Badge/BadgeInterface";
import { cn } from "@/utils/cn/cn";

export function Badge({ className, tone, ...props }: BadgeProps) {
	return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
