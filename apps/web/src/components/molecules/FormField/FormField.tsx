import { Label } from "@/components/atoms/Label/Label";
import type { FormFieldProps } from "@/components/molecules/FormField/FormFieldInterface";

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
