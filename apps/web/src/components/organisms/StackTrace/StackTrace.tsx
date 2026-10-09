import type { ExceptionValue } from "@sentinel/shared";
import { ExceptionBlock } from "@/components/organisms/StackTrace/ExceptionBlock/ExceptionBlock";

/**
 * `exceptions` llega con la causa más profunda primero y la excepción principal al final.
 * En pantalla se muestra primero la principal y después sus causas.
 */
export function StackTrace({ exceptions }: { exceptions: ExceptionValue[] }) {
	const ordered = [...exceptions].reverse();
	return (
		<div>
			{ordered.map((value, i) => (
				<ExceptionBlock
					// biome-ignore lint/suspicious/noArrayIndexKey: lista inmutable derivada del evento; las excepciones no tienen id propio
					key={`${value.type}-${i}`}
					value={value}
					cause={i > 0}
				/>
			))}
		</div>
	);
}
