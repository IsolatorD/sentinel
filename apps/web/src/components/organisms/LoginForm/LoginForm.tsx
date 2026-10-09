import { useNavigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/atoms/Button/Button";
import { Input } from "@/components/atoms/Input/Input";
import { Alert } from "@/components/molecules/Alert/Alert";
import { FormField } from "@/components/molecules/FormField/FormField";
import { GoogleButton } from "@/components/molecules/GoogleButton/GoogleButton";
import { credentialsSchema } from "@/components/organisms/LoginForm/LoginForm.constants";
import { usePublicConfig } from "@/hooks/usePublicConfig/usePublicConfig";
import { useRedirectTarget } from "@/hooks/useSearchParams/useSearchParams";
import {
	useGoogleSignIn,
	useSession,
	useSignIn,
} from "@/hooks/useSession/useSession";
import { ApiError } from "@/utils/apiError/apiError";

export function LoginForm() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const signIn = useSignIn();
	const google = useGoogleSignIn();
	const config = usePublicConfig();
	const session = useSession();
	const redirectTo = useRedirectTarget();
	const [fieldErrors, setFieldErrors] = useState<{
		email?: string;
		password?: string;
	}>({});

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		const parsed = credentialsSchema.safeParse({
			email: form.get("email"),
			password: form.get("password"),
		});
		if (!parsed.success) {
			const issues = parsed.error.flatten().fieldErrors;
			setFieldErrors({
				email:
					issues.email?.[0] === "email"
						? t("auth.validation.email")
						: issues.email
							? t("auth.validation.required")
							: undefined,
				password: issues.password ? t("auth.validation.required") : undefined,
			});
			return;
		}
		setFieldErrors({});
		signIn.mutate(parsed.data, {
			onSuccess: () => navigate({ href: redirectTo ?? "/" }),
		});
	}

	const error = signIn.error;
	const message =
		error instanceof ApiError && error.status === 401
			? t("auth.login.invalidCredentials")
			: error
				? t("common.genericError")
				: null;

	return (
		<form
			onSubmit={onSubmit}
			noValidate
			className="space-y-4"
			data-testid="login-form"
		>
			{message && <Alert variant="error">{message}</Alert>}
			<FormField
				label={t("auth.login.email")}
				htmlFor="email"
				error={fieldErrors.email}
			>
				<Input
					id="email"
					name="email"
					type="email"
					autoComplete="email"
					invalid={Boolean(fieldErrors.email)}
				/>
			</FormField>
			<FormField
				label={t("auth.login.password")}
				htmlFor="password"
				error={fieldErrors.password}
			>
				<Input
					id="password"
					name="password"
					type="password"
					autoComplete="current-password"
					invalid={Boolean(fieldErrors.password)}
				/>
			</FormField>
			<Button
				type="submit"
				variant="primary"
				className="w-full"
				loading={signIn.isPending || session.isFetching}
			>
				{signIn.isPending ? t("auth.login.submitting") : t("auth.login.submit")}
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
