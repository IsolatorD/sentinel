import { Link, useNavigate } from "@tanstack/react-router";
import { CircleCheck } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/atoms/Button/Button";
import { Input } from "@/components/atoms/Input/Input";
import { Alert } from "@/components/molecules/Alert/Alert";
import { FormField } from "@/components/molecules/FormField/FormField";
import { ERROR_KEYS } from "@/components/organisms/EmailVerifiedCard/EmailVerifiedCard.constants";
import type { EmailVerifiedCardProps } from "@/components/organisms/EmailVerifiedCard/EmailVerifiedCardInterface";
import { useResendVerification } from "@/hooks/useSession/useSession";
import { apiErrorText } from "@/utils/apiErrorText/apiErrorText";
import { verificationCallbackUrl } from "@/utils/verification/verification";

/** Resultado de abrir el enlace de verificación: éxito (y seguir) o error (y pedir otro enlace). */
export function EmailVerifiedCard({ error, redirect }: EmailVerifiedCardProps) {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const resend = useResendVerification();
	const [email, setEmail] = useState("");

	if (!error) {
		return (
			<div className="space-y-5" data-testid="email-verified">
				<div className="flex items-start gap-3">
					<span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
						<CircleCheck aria-hidden className="size-5" />
					</span>
					<p className="text-sm text-foreground">{t("emailVerified.ok")}</p>
				</div>
				<Button
					variant="primary"
					onClick={() => navigate({ href: redirect ?? "/" })}
				>
					{t("emailVerified.continue")}
				</Button>
			</div>
		);
	}

	const reason =
		error in ERROR_KEYS
			? t(ERROR_KEYS[error as keyof typeof ERROR_KEYS])
			: t("emailVerified.errors.generic");

	function onSubmit(event: FormEvent) {
		event.preventDefault();
		if (!email.trim()) return;
		resend.mutate({
			email: email.trim(),
			callbackURL: verificationCallbackUrl(window.location.origin, redirect),
		});
	}

	return (
		<div className="space-y-5" data-testid="email-verify-error">
			<Alert variant="error">{reason}</Alert>
			<form onSubmit={onSubmit} noValidate className="space-y-3">
				<p className="text-sm text-muted">{t("emailVerified.resendIntro")}</p>
				{resend.isError && (
					<Alert variant="error">
						{apiErrorText(resend.error, t("common.genericError"))}
					</Alert>
				)}
				<FormField label={t("emailVerified.email")} htmlFor="verify-email">
					<Input
						id="verify-email"
						type="email"
						autoComplete="email"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
					/>
				</FormField>
				<div className="flex items-center gap-3">
					<Button
						type="submit"
						variant="primary"
						loading={resend.isPending}
						disabled={!email.trim()}
					>
						{t("emailVerified.resend")}
					</Button>
					<Link
						to="/login"
						search={redirect ? { redirect } : {}}
						className="text-sm font-medium text-primary hover:underline"
					>
						{t("verifyEmail.backToLogin")}
					</Link>
				</div>
			</form>
		</div>
	);
}
