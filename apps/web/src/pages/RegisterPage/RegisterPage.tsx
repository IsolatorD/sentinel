import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Alert } from "@/components/molecules/Alert/Alert";
import { RegisterForm } from "@/components/organisms/RegisterForm/RegisterForm";
import { AuthTemplate } from "@/components/templates/AuthTemplate/AuthTemplate";
import { useRedirectTarget } from "@/hooks/useSearchParams/useSearchParams";
import { useSignUpEnabled } from "@/hooks/useSignUpEnabled/useSignUpEnabled";

export function RegisterPage() {
	const { t } = useTranslation();
	const redirect = useRedirectTarget();
	const signUpEnabled = useSignUpEnabled();
	return (
		<AuthTemplate
			title={t("auth.register.title")}
			subtitle={t("auth.register.subtitle")}
			footer={
				<>
					{t("auth.register.haveAccount")}{" "}
					<Link
						to="/login"
						search={{ redirect }}
						className="font-medium text-primary hover:underline"
					>
						{t("auth.register.signInLink")}
					</Link>
				</>
			}
		>
			{signUpEnabled ? (
				<RegisterForm />
			) : (
				<Alert variant="info">{t("auth.register.closed")}</Alert>
			)}
		</AuthTemplate>
	);
}
