import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { LoginForm } from "@/components/organisms/LoginForm/LoginForm";
import { AuthTemplate } from "@/components/templates/AuthTemplate/AuthTemplate";
import { useRedirectTarget } from "@/hooks/useSearchParams/useSearchParams";
import { useSignUpEnabled } from "@/hooks/useSignUpEnabled/useSignUpEnabled";

export function LoginPage() {
	const { t } = useTranslation();
	const redirect = useRedirectTarget();
	const signUpEnabled = useSignUpEnabled();
	return (
		<AuthTemplate
			title={t("auth.login.title")}
			subtitle={t("auth.login.subtitle")}
			footer={
				signUpEnabled ? (
					<>
						{t("auth.login.noAccount")}{" "}
						<Link
							to="/register"
							search={{ redirect }}
							className="font-medium text-primary hover:underline"
						>
							{t("auth.login.signUpLink")}
						</Link>
					</>
				) : undefined
			}
		>
			<LoginForm />
		</AuthTemplate>
	);
}
