import type { CollapseProps } from "@/components/molecules/Collapse/CollapseInterface";
import { cn } from "@/utils/cn/cn";

/**
 * Despliega su contenido con una animación de altura. El contenido solo existe mientras está abierto:
 * no queda oculto en el DOM, así que lo cerrado no cuesta nada ni es accesible por error.
 */
export function Collapse({ open, children, className }: CollapseProps) {
	if (!open) return null;
	return (
		<div className={cn("grid animate-expand", className)}>
			<div className="min-h-0 overflow-hidden">{children}</div>
		</div>
	);
}
