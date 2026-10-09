import { cva } from "class-variance-authority";

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
