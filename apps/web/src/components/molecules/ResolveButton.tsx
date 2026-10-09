import type { Resolution } from "@sentinel/shared";
import { CheckCircle2, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/atoms/Button/Button";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "./Menu";

export interface ResolveButtonProps {
	/** `undefined` = resolver sin ligarlo a una release (cualquier evento nuevo lo reabre). */
	onResolve: (resolution?: Resolution) => void;
	loading?: boolean;
	/** Última release conocida del proyecto; habilita "resolver en la release actual". */
	currentRelease?: string;
}

/** "Resolver" con un menú para ligar la resolución a una release (próxima o la actual). */
export function ResolveButton({
	onResolve,
	loading,
	currentRelease,
}: ResolveButtonProps) {
	const { t } = useTranslation();
	return (
		<div className="inline-flex">
			<Button
				variant="primary"
				loading={loading}
				onClick={() => onResolve()}
				className="rounded-r-none"
			>
				<CheckCircle2 className="size-4" />
				{t("issue.actions.resolve")}
			</Button>
			<Menu>
				<MenuTrigger asChild>
					<Button
						variant="primary"
						size="icon"
						disabled={loading}
						aria-label={t("issue.actions.resolveOptions")}
						className="h-9 w-8 rounded-l-none border-l-white/25"
					>
						<ChevronDown className="size-4" />
					</Button>
				</MenuTrigger>
				<MenuContent align="end">
					<MenuItem onSelect={() => onResolve({ type: "next_release" })}>
						{t("issue.actions.resolveNextRelease")}
					</MenuItem>
					{currentRelease && (
						<MenuItem
							onSelect={() =>
								onResolve({ type: "release", release: currentRelease })
							}
						>
							{t("issue.actions.resolveInRelease", { release: currentRelease })}
						</MenuItem>
					)}
				</MenuContent>
			</Menu>
		</div>
	);
}
