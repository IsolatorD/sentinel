import { colorFor, initials } from "@/components/atoms/Avatar/Avatar.constants";
import { cn } from "@/utils/cn/cn";

export function Avatar({
	name,
	className,
	rounded = "md",
}: {
	name: string;
	className?: string;
	rounded?: "md" | "full";
}) {
	return (
		<span
			aria-hidden
			style={{ backgroundColor: colorFor(name) }}
			className={cn(
				"inline-flex size-7 shrink-0 items-center justify-center text-[11px] font-semibold text-white",
				rounded === "full" ? "rounded-full" : "rounded-md",
				className,
			)}
		>
			{initials(name)}
		</span>
	);
}
