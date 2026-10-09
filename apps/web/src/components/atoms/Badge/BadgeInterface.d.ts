import type { VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import type { badgeVariants } from "@/components/atoms/Badge/Badge.constants";

export interface BadgeProps
	extends HTMLAttributes<HTMLSpanElement>,
		VariantProps<typeof badgeVariants> {}
