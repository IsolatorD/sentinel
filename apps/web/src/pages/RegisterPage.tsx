import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { RegisterForm } from "@/components/organisms/RegisterForm/RegisterForm";
import { AuthTemplate } from "@/components/templates/AuthTemplate";

export function RegisterPage() {
	const { t } = useTranslation();
	return (
		<AuthTemplate
			title={t("auth.register.title")}
			subtitle={t("auth.register.subtitle")}
			footer={
				<>
					{t("auth.register.haveAccount")}{" "}
					<Link
						to="/login"
						className="font-medium text-primary hover:underline"
					>
						{t("auth.register.signInLink")}
					</Link>
				</>
			}
		>
			<RegisterForm />
		</AuthTemplate>
	);
}
