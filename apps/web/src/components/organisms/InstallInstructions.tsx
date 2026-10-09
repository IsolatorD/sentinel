import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CodeBlock } from "@/components/molecules/CodeBlock";
import { cn } from "@/lib/cn";
import { npmSnippet, scriptTagSnippet } from "@/lib/install-snippets";

export function InstallInstructions({ dsn }: { dsn: string }) {
	const { t } = useTranslation();
	const [tab, setTab] = useState<"npm" | "script">("npm");
	const npm = npmSnippet({ dsn });

	return (
		<div data-testid="install-instructions">
			<div role="tablist" className="mb-3 flex gap-4 border-b border-border">
				{(["npm", "script"] as const).map((id) => (
					<button
						key={id}
						type="button"
						role="tab"
						aria-selected={tab === id}
						onClick={() => setTab(id)}
						className={cn(
							"-mb-px border-b-2 px-0.5 pb-2 text-sm font-medium",
							tab === id
								? "border-primary text-foreground"
								: "border-transparent text-muted hover:text-foreground",
						)}
					>
						{t(`settings.install.${id}`)}
					</button>
				))}
			</div>
			{tab === "npm" ? (
				<div className="space-y-3">
					<CodeBlock title={t("settings.install.install")} code={npm.install} />
					<CodeBlock title={t("settings.install.configure")} code={npm.code} />
				</div>
			) : (
				<CodeBlock title="HTML" code={scriptTagSnippet({ dsn })} />
			)}
		</div>
	);
}
