import type { VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import type { buttonVariants } from "@/components/atoms/Button/Button.constants";

export interface ButtonProps
	extends ButtonHTMLAttributes<HTMLButtonElement>,
		VariantProps<typeof buttonVariants> {
	loading?: boolean;
}
