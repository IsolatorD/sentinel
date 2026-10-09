import type { Resolution } from "@sentinel/shared";

export interface ResolveButtonProps {
	/** `undefined` = resolver sin ligarlo a una release (cualquier evento nuevo lo reabre). */
	onResolve: (resolution?: Resolution) => void;
	loading?: boolean;
	/** Última release conocida del proyecto; habilita "resolver en la release actual". */
	currentRelease?: string;
}
