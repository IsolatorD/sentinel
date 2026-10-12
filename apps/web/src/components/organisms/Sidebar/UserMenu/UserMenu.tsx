import { useNavigate } from "@tanstack/react-router";
import { CircleHelp, LogOut, Mail, MailX } from "lucide-react";
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
import {
	usePreferences,
	useUpdatePreferences,
} from "@/hooks/usePreferences/usePreferences";
import { useSession, useSignOut } from "@/hooks/useSession/useSession";
import { useTheme } from "@/hooks/useTheme/useTheme";
import { cn } from "@/utils/cn/cn";

export function UserMenu({
	onStartTour,
	collapsed = false,
}: {
	/** Modo mini: solo el avatar. */
	collapsed?: boolean;
	/** Repite el recorrido guiado de bienvenida. */
	onStartTour?: () => void;
}) {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const session = useSession();
	const signOut = useSignOut();
	const { theme, setTheme } = useTheme();
	const savePreferences = useUpdatePreferences();
	const emailOnAssign = usePreferences().data?.emailOnAssign ?? true;
	const user = session.data?.user;
	if (!user) return null;

	return (
		<Menu>
			<MenuTrigger
				data-tour="user-menu"
				className={cn(
					"flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-sidebar-hover",
					collapsed && "justify-center px-0",
				)}
				aria-label={t("nav.account")}
				title={collapsed ? user.name : undefined}
			>
				<Avatar name={user.name} rounded="full" />
				{!collapsed && (
					<span className="min-w-0 flex-1">
						<span className="block truncate text-sm font-medium text-white">
							{user.name}
						</span>
						<span className="block truncate text-xs text-sidebar-muted">
							{user.email}
						</span>
					</span>
				)}
			</MenuTrigger>
			<MenuContent
				align="start"
				side={collapsed ? "right" : "top"}
				className="w-64"
			>
				<MenuLabel>{t("common.language")}</MenuLabel>
				<div className="px-2 pb-1">
					<LanguageSelect
						onChange={(language) =>
							savePreferences.mutate({ locale: language as "en" | "es" })
						}
					/>
				</div>
				<MenuLabel>{t("common.theme")}</MenuLabel>
				<div className="px-2 pb-1">
					<ThemeSelect
						value={theme}
						onChange={(next) => {
							setTheme(next);
							savePreferences.mutate({ theme: next });
						}}
					/>
				</div>
				<MenuSeparator />
				<MenuItem
					onSelect={() =>
						savePreferences.mutate({ emailOnAssign: !emailOnAssign })
					}
				>
					{emailOnAssign ? (
						<Mail aria-hidden className="size-4" />
					) : (
						<MailX aria-hidden className="size-4" />
					)}
					{emailOnAssign ? t("nav.assignEmailOn") : t("nav.assignEmailOff")}
				</MenuItem>
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
