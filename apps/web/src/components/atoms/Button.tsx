import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./Spinner";

export const buttonVariants = cva(
	"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
	{
		variants: {
			variant: {
				primary:
					"border-primary bg-primary text-white shadow-sm hover:border-primary-hover hover:bg-primary-hover",
				secondary:
					"border-border-strong bg-surface text-foreground shadow-sm hover:bg-subtle",
				ghost:
					"border-transparent bg-transparent text-muted hover:bg-subtle hover:text-foreground",
				danger: "border-danger bg-danger text-white shadow-sm hover:opacity-90",
				"danger-outline":
					"border-danger/40 bg-surface text-danger hover:bg-danger/5",
			},
			size: {
				sm: "h-7 px-2.5 text-xs",
				md: "h-9 px-3.5 text-sm",
				lg: "h-10 px-5 text-sm",
				icon: "size-8",
			},
		},
		defaultVariants: { variant: "secondary", size: "md" },
	},
);

export interface ButtonProps
	extends ButtonHTMLAttributes<HTMLButtonElement>,
		VariantProps<typeof buttonVariants> {
	loading?: boolean;
}

export function Button({
	className,
	variant,
	size,
	loading,
	disabled,
	children,
	type = "button",
	...props
}: ButtonProps) {
	return (
		<button
			type={type}
			className={cn(buttonVariants({ variant, size }), className)}
			disabled={disabled || loading}
			aria-busy={loading || undefined}
			{...props}
		>
			{loading && <Spinner className="text-current" />}
			{children}
		</button>
	);
}
