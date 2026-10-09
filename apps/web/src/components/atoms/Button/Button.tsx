import { buttonVariants } from "@/components/atoms/Button/Button.constants";
import type { ButtonProps } from "@/components/atoms/Button/ButtonInterface";
import { Spinner } from "@/components/atoms/Spinner/Spinner";
import { cn } from "@/utils/cn/cn";

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
