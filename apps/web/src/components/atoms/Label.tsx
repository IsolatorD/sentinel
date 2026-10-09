import type { LabelHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Label({
	className,
	htmlFor,
	...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
	return (
		// biome-ignore lint/a11y/noLabelWithoutControl: el control se asocia con htmlFor desde FormField
		<label
			htmlFor={htmlFor}
			className={cn("mb-1 block text-xs font-medium text-muted", className)}
			{...props}
		/>
	);
}
