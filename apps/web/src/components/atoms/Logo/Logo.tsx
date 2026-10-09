import { LogoMark } from "@/components/atoms/LogoMark/LogoMark";
import { cn } from "@/utils/cn/cn";

export function Logo({
	className,
	markClassName,
}: {
	className?: string;
	markClassName?: string;
}) {
	return (
		<span
			className={cn(
				"inline-flex items-center gap-2 font-semibold tracking-tight",
				className,
			)}
		>
			<LogoMark className={markClassName} />
			<span>Sentinel</span>
		</span>
	);
}
