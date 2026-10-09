import type { Ref, SelectHTMLAttributes } from "react";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
	ref?: Ref<HTMLSelectElement>;
}
