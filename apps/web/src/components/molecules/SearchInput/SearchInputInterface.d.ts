import type { InputHTMLAttributes } from "react";

export interface SearchInputProps
	extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
	value: string;
	onChange: (value: string) => void;
	clearLabel?: string;
}
