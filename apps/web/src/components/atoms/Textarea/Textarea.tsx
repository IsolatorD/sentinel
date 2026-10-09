import type { TextareaProps } from "@/components/atoms/Textarea/TextareaInterface";
import { cn } from "@/utils/cn/cn";

export function Textarea({ className, invalid, ref, ...props }: TextareaProps) {
	return (
		<textarea
			ref={ref}
			aria-invalid={invalid || undefined}
			className={cn(
				"min-h-20 w-full resize-y rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-faint focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:bg-subtle disabled:opacity-70",
				invalid && "border-danger focus:border-danger focus:ring-danger/25",
				className,
			)}
			{...props}
		/>
	);
}
