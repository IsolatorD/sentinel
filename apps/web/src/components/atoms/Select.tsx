import { ChevronDown } from "lucide-react";
import type { Ref, SelectHTMLAttributes } from "react";
import { cn } from "@/utils/cn/cn";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
	ref?: Ref<HTMLSelectElement>;
}

/**
 * Select nativo con el estilo de la app (accesible y funciona bien en móvil).
 * `className` se aplica al contenedor, así que sirve para fijar el ancho.
 */
export function Select({ className, children, ref, ...props }: SelectProps) {
	return (
		<span className={cn("relative inline-flex w-full", className)}>
			<select
				ref={ref}
				className="h-9 w-full appearance-none rounded-md border border-border-strong bg-surface pr-8 pl-3 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
				{...props}
			>
				{children}
			</select>
			<ChevronDown
				aria-hidden
				className="pointer-events-none absolute top-2.5 right-2.5 size-4 text-faint"
			/>
		</span>
	);
}
