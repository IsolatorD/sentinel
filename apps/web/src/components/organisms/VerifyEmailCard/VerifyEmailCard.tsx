import { Link } from "@tanstack/react-router";
import { MailCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/atoms/Button/Button";
import { Alert } from "@/components/molecules/Alert/Alert";
import { RESEND_COOLDOWN_SECONDS } from "@/components/organisms/VerifyEmailCard/VerifyEmailCard.constants";
import type { VerifyEmailCardProps } from "@/components/organisms/VerifyEmailCard/VerifyEmailCardInterface";
import { useResendVerification } from "@/hooks/useSession/useSession";
import { apiErrorText } from "@/utils/apiErrorText/apiErrorText";
import { verificationCallbackUrl } from "@/utils/verification/verification";

/** "Revisa tu correo": se mandó un enlace para activar la cuenta, con opción de pedirlo de nuevo. */
export function VerifyEmailCard({ email, redirect }: VerifyEmailCardProps) {
	const { t } = useTranslation();
	const resend = useResendVerification();
	const [wait, setWait] = useState(0);

	useEffect(() => {
		if (wait <= 0) return;
		const timer = setTimeout(() => setWait((s) => s - 1), 1000);
		return () => clearTimeout(timer);
	}, [wait]);

	function onResend() {
		if (!email) return;
		resend.mutate(
			{
				email,
				callbackURL: verificationCallbackUrl(window.location.origin, redirect),
			},
			{ onSuccess: () => setWait(RESEND_COOLDOWN_SECONDS) },
		);
	}

	return (
		<div className="space-y-5" data-testid="verify-email">
			<div className="flex items-start gap-3">
				<span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
					<MailCheck aria-hidden className="size-5" />
				</span>
				<p className="text-sm text-foreground">
					{email ? t("verifyEmail.sent", { email }) : t("verifyEmail.noEmail")}
				</p>
			</div>
			{resend.isError && (
				<Alert variant="error">
					{apiErrorText(resend.error, t("common.genericError"))}
				</Alert>
			)}
			<div className="flex flex-wrap items-center gap-3">
				{email && (
					<Button
						onClick={onResend}
						loading={resend.isPending}
						disabled={wait > 0}
					>
						{wait > 0
							? t("verifyEmail.resendIn", { seconds: wait })
							: t("verifyEmail.resend")}
					</Button>
				)}
				<Link
					to="/login"
					search={redirect ? { redirect } : {}}
					className="text-sm font-medium text-primary hover:underline"
				>
					{t("verifyEmail.backToLogin")}
				</Link>
			</div>
		</div>
	);
}
