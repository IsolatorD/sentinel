import type { CheckboxProps } from "@/components/atoms/Checkbox/CheckboxInterface";
import { cn } from "@/utils/cn/cn";

export function Checkbox({ className, ...props }: CheckboxProps) {
	return (
		<input
			type="checkbox"
			className={cn(
				"size-4 shrink-0 cursor-pointer rounded border-border-strong accent-primary focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60",
				className,
			)}
			{...props}
		/>
	);
}
