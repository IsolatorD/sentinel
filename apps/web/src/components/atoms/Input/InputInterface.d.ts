import type { InputHTMLAttributes, Ref } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
	invalid?: boolean;
	ref?: Ref<HTMLInputElement>;
}
