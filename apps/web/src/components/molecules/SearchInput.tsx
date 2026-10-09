import { Search, X } from "lucide-react";
import type { InputHTMLAttributes } from "react";
import { Input } from "@/components/atoms/Input";
import { cn } from "@/lib/cn";

export interface SearchInputProps
	extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
	value: string;
	onChange: (value: string) => void;
	clearLabel?: string;
}

export function SearchInput({
	value,
	onChange,
	className,
	clearLabel = "Clear",
	...props
}: SearchInputProps) {
	return (
		<div className={cn("relative", className)}>
			<Search
				aria-hidden
				className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-faint"
			/>
			<Input
				type="search"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				className="pr-8 pl-8"
				{...props}
			/>
			{value && (
				<button
					type="button"
					aria-label={clearLabel}
					onClick={() => onChange("")}
					className="absolute top-2 right-2 rounded p-0.5 text-faint hover:bg-subtle hover:text-foreground"
				>
					<X className="size-4" />
				</button>
			)}
		</div>
	);
}
