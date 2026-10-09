import type { Ref, TextareaHTMLAttributes } from "react";

export interface TextareaProps
	extends TextareaHTMLAttributes<HTMLTextAreaElement> {
	invalid?: boolean;
	ref?: Ref<HTMLTextAreaElement>;
}
