import { useNavigate } from "@tanstack/react-router";
import { CircleHelp, LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Avatar } from "@/components/atoms/Avatar/Avatar";
import { LanguageSelect } from "@/components/molecules/LanguageSelect/LanguageSelect";
import { Menu } from "@/components/molecules/Menu/Menu";
import { MenuContent } from "@/components/molecules/MenuContent/MenuContent";
import { MenuItem } from "@/components/molecules/MenuItem/MenuItem";
import { MenuLabel } from "@/components/molecules/MenuLabel/MenuLabel";
import { MenuSeparator } from "@/components/molecules/MenuSeparator/MenuSeparator";
import { MenuTrigger } from "@/components/molecules/MenuTrigger/MenuTrigger";
import { ThemeSelect } from "@/components/molecules/ThemeSelect/ThemeSelect";
import { useSession, useSignOut } from "@/hooks/useSession/useSession";
import { useTheme } from "@/hooks/useTheme/useTheme";

export function UserMenu({
	onStartTour,
}: {
	/** Repite el recorrido guiado de bienvenida. */
	onStartTour?: () => void;
}) {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const session = useSession();
	const signOut = useSignOut();
	const { theme, setTheme } = useTheme();
	const user = session.data?.user;
	if (!user) return null;

	return (
		<Menu>
			<MenuTrigger
				data-tour="user-menu"
				className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-sidebar-hover"
				aria-label={t("nav.account")}
			>
				<Avatar name={user.name} rounded="full" />
				<span className="min-w-0 flex-1">
					<span className="block truncate text-sm font-medium text-white">
						{user.name}
					</span>
					<span className="block truncate text-xs text-sidebar-muted">
						{user.email}
					</span>
				</span>
			</MenuTrigger>
			<MenuContent align="start" side="top" className="w-64">
				<MenuLabel>{t("common.language")}</MenuLabel>
				<div className="px-2 pb-1">
					<LanguageSelect />
				</div>
				<MenuLabel>{t("common.theme")}</MenuLabel>
				<div className="px-2 pb-1">
					<ThemeSelect value={theme} onChange={setTheme} />
				</div>
				<MenuSeparator />
				{onStartTour && (
					<MenuItem onSelect={onStartTour}>
						<CircleHelp aria-hidden className="size-4" />
						{t("tour.replay")}
					</MenuItem>
				)}
				<MenuItem
					onSelect={() =>
						signOut.mutate(undefined, {
							onSuccess: () => navigate({ to: "/login" }),
						})
					}
				>
					<LogOut aria-hidden className="size-4" />
					{t("nav.signOut")}
				</MenuItem>
			</MenuContent>
		</Menu>
	);
}
