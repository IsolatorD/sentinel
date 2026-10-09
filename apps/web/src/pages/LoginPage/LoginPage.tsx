import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { LoginForm } from "@/components/organisms/LoginForm/LoginForm";
import { AuthTemplate } from "@/components/templates/AuthTemplate/AuthTemplate";
import { useRedirectTarget } from "@/hooks/useSearchParams/useSearchParams";

export function LoginPage() {
	const { t } = useTranslation();
	const redirect = useRedirectTarget();
	return (
		<AuthTemplate
			title={t("auth.login.title")}
			subtitle={t("auth.login.subtitle")}
			footer={
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
			}
		>
			<LoginForm />
		</AuthTemplate>
	);
}
