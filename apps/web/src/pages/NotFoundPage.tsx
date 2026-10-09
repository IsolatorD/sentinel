import { Link } from "@tanstack/react-router";
import { Compass } from "lucide-react";
import { useTranslation } from "react-i18next";
import { buttonVariants } from "@/components/atoms/Button";
import { EmptyState } from "@/components/molecules/EmptyState";

export function NotFoundPage() {
	const { t } = useTranslation();
	return (
		<div className="flex min-h-full items-center justify-center">
			<EmptyState
				icon={Compass}
				title={t("notFound.title")}
				description={t("notFound.description")}
				action={
					<Link to="/" className={buttonVariants({ variant: "primary" })}>
						{t("notFound.home")}
					</Link>
				}
			/>
		</div>
	);
}
