import { useNavigate } from "@tanstack/react-router";
import { ChevronsUpDown, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Avatar } from "@/components/atoms/Avatar/Avatar";
import { Menu } from "@/components/molecules/Menu/Menu";
import { MenuContent } from "@/components/molecules/MenuContent/MenuContent";
import { MenuItem } from "@/components/molecules/MenuItem/MenuItem";
import { MenuLabel } from "@/components/molecules/MenuLabel/MenuLabel";
import { MenuSeparator } from "@/components/molecules/MenuSeparator/MenuSeparator";
import { MenuTrigger } from "@/components/molecules/MenuTrigger/MenuTrigger";
import { useCurrentOrganization } from "@/hooks/useScope/useScope";
import { writeStorage } from "@/utils/storage/storage";
import { LAST_ORG_KEY } from "@/utils/storage/storage.constants";

export function OrgSwitcher() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { organization, organizations } = useCurrentOrganization();
	if (!organization) return null;

	return (
		<Menu>
			<MenuTrigger
				data-tour="org-switcher"
				className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-sidebar-hover focus-visible:outline-primary"
				aria-label={t("nav.switchOrganization")}
			>
				<Avatar name={organization.name} />
				<span className="min-w-0 flex-1 truncate text-sm font-medium text-white">
					{organization.name}
				</span>
				<ChevronsUpDown
					aria-hidden
					className="size-4 shrink-0 text-sidebar-muted"
				/>
			</MenuTrigger>
			<MenuContent align="start" className="w-64">
				<MenuLabel>{t("nav.switchOrganization")}</MenuLabel>
				{organizations.map((org) => (
					<MenuItem
						key={org.id}
						onSelect={() => {
							writeStorage(LAST_ORG_KEY, org.slug);
							navigate({ to: "/$orgSlug", params: { orgSlug: org.slug } });
						}}
					>
						<Avatar name={org.name} className="size-5 text-[9px]" />
						<span className="truncate">{org.name}</span>
					</MenuItem>
				))}
				<MenuSeparator />
				<MenuItem onSelect={() => navigate({ to: "/onboarding" })}>
					<Plus aria-hidden className="size-4" />
					{t("nav.createOrganization")}
				</MenuItem>
			</MenuContent>
		</Menu>
	);
}
