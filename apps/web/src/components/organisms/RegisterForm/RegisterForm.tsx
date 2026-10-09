import { useNavigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/atoms/Button/Button";
import { Input } from "@/components/atoms/Input/Input";
import { Alert } from "@/components/molecules/Alert/Alert";
import { FormField } from "@/components/molecules/FormField/FormField";
import { GoogleButton } from "@/components/molecules/GoogleButton/GoogleButton";
import { schema } from "@/components/organisms/RegisterForm/RegisterForm.constants";
import type { Errors } from "@/components/organisms/RegisterForm/RegisterFormInterface";
import { usePublicConfig } from "@/hooks/usePublicConfig/usePublicConfig";
import { useRedirectTarget } from "@/hooks/useSearchParams/useSearchParams";
import { useGoogleSignIn, useSignUp } from "@/hooks/useSession/useSession";
import { ApiError } from "@/utils/apiError/apiError";

export function RegisterForm() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const signUp = useSignUp();
	const google = useGoogleSignIn();
	const config = usePublicConfig();
	const redirectTo = useRedirectTarget();
	const [errors, setErrors] = useState<Errors>({});

	function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		const parsed = schema.safeParse({
			name: form.get("name"),
			email: form.get("email"),
			password: form.get("password"),
		});
		if (!parsed.success) {
			const next: Errors = {};
			for (const issue of parsed.error.issues) {
				const field = issue.path[0] as keyof Errors;
				if (next[field]) continue;
				next[field] =
					field === "password"
						? t("auth.validation.passwordLength")
						: field === "email" && issue.code === "invalid_format"
							? t("auth.validation.email")
							: t("auth.validation.required");
			}
			setErrors(next);
			return;
		}
		setErrors({});
		signUp.mutate(parsed.data, {
			onSuccess: () => navigate({ href: redirectTo ?? "/onboarding" }),
		});
	}

	const error = signUp.error;
	const message =
		error instanceof ApiError
			? error.code === "USER_ALREADY_EXISTS" ||
				/exist|already/i.test(error.message)
				? t("auth.register.emailTaken")
				: t("common.genericError")
			: error
				? t("common.genericError")
				: null;

	return (
		<form
			onSubmit={onSubmit}
			noValidate
			className="space-y-4"
			data-testid="register-form"
		>
			{message && <Alert variant="error">{message}</Alert>}
			<FormField
				label={t("auth.register.name")}
				htmlFor="name"
				error={errors.name}
			>
				<Input
					id="name"
					name="name"
					autoComplete="name"
					invalid={Boolean(errors.name)}
				/>
			</FormField>
			<FormField
				label={t("auth.register.email")}
				htmlFor="email"
				error={errors.email}
			>
				<Input
					id="email"
					name="email"
					type="email"
					autoComplete="email"
					invalid={Boolean(errors.email)}
				/>
			</FormField>
			<FormField
				label={t("auth.register.password")}
				htmlFor="password"
				hint={t("auth.register.passwordHint")}
				error={errors.password}
			>
				<Input
					id="password"
					name="password"
					type="password"
					autoComplete="new-password"
					invalid={Boolean(errors.password)}
				/>
			</FormField>
			<Button
				type="submit"
				variant="primary"
				className="w-full"
				loading={signUp.isPending}
			>
				{signUp.isPending
					? t("auth.register.submitting")
					: t("auth.register.submit")}
			</Button>
			{config.data?.authProviders.google && (
				<>
					<div className="flex items-center gap-3 text-xs text-faint">
						<span className="h-px flex-1 bg-border" />
						{t("common.or")}
						<span className="h-px flex-1 bg-border" />
					</div>
					<GoogleButton
						label={t("auth.login.google")}
						loading={google.isPending}
						onClick={() => google.mutate(redirectTo)}
					/>
				</>
			)}
		</form>
	);
}
