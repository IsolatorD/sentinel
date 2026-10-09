import type { ReactNode } from "react";
import { Label } from "@/components/atoms/Label";

export interface FormFieldProps {
	label: string;
	htmlFor: string;
	hint?: string;
	error?: string;
	children: ReactNode;
}

export function FormField({
	label,
	htmlFor,
	hint,
	error,
	children,
}: FormFieldProps) {
	return (
		<div>
			<Label htmlFor={htmlFor}>{label}</Label>
			{children}
			{error ? (
				<p
					id={`${htmlFor}-error`}
					role="alert"
					className="mt-1 text-xs text-danger"
				>
					{error}
				</p>
			) : hint ? (
				<p className="mt-1 text-xs text-faint">{hint}</p>
			) : null}
		</div>
	);
}
