import type { InputHTMLAttributes, Ref } from "react";
import { cn } from "@/lib/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
	invalid?: boolean;
	ref?: Ref<HTMLInputElement>;
}

export function Input({ className, invalid, ref, ...props }: InputProps) {
	return (
		<input
			ref={ref}
			aria-invalid={invalid || undefined}
			className={cn(
				"h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground shadow-sm placeholder:text-faint focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:bg-subtle disabled:opacity-70",
				invalid && "border-danger focus:border-danger focus:ring-danger/25",
				className,
			)}
			{...props}
		/>
	);
}
