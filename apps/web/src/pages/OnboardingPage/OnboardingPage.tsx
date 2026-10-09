import { useTranslation } from "react-i18next";
import { OnboardingFlow } from "@/components/organisms/OnboardingFlow/OnboardingFlow";
import { AuthTemplate } from "@/components/templates/AuthTemplate/AuthTemplate";

export function OnboardingPage() {
	const { t } = useTranslation();
	return (
		<AuthTemplate
			wide
			title={t("onboarding.title")}
			subtitle={t("onboarding.subtitle")}
		>
			<OnboardingFlow />
		</AuthTemplate>
	);
}
