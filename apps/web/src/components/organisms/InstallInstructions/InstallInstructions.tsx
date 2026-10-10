import { platformSchema } from "@sentinel/shared";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CodeBlock } from "@/components/molecules/CodeBlock/CodeBlock";
import { METHODS } from "@/components/organisms/InstallInstructions/InstallInstructions.constants";
import type {
	InstallInstructionsProps,
	Method,
} from "@/components/organisms/InstallInstructions/InstallInstructionsInterface";
import { cn } from "@/utils/cn/cn";
import {
	httpSnippet,
	nodeSnippet,
	npmSnippet,
	reactSnippet,
	scriptTagSnippet,
} from "@/utils/installSnippets/installSnippets";

export function InstallInstructions({
	dsn,
	platform: rawPlatform,
}: InstallInstructionsProps) {
	// Una plataforma que este panel no conoce se trata como "other".
	const platform = platformSchema.catch("other").parse(rawPlatform);
	const { t } = useTranslation();
	const methods = METHODS[platform];
	const [picked, setPicked] = useState<Method>();
	const tab = picked && methods.includes(picked) ? picked : methods[0];
	const npm =
		platform === "react"
			? reactSnippet({ dsn })
			: platform === "node"
				? nodeSnippet({ dsn })
				: npmSnippet({ dsn });

	return (
		<div data-testid="install-instructions" data-platform={platform}>
			{methods.length > 1 && (
				<div role="tablist" className="mb-3 flex gap-4 border-b border-border">
					{methods.map((id) => (
						<button
							key={id}
							type="button"
							role="tab"
							aria-selected={tab === id}
							onClick={() => setPicked(id)}
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
			)}
			<p className="mb-3 text-sm text-muted">
				{t(`settings.install.hint.${platform}`)}
			</p>
			{tab === "npm" ? (
				<div key={`npm-${platform}`} className="animate-fade-in space-y-3">
					<CodeBlock title={t("settings.install.install")} code={npm.install} />
					<CodeBlock title={t("settings.install.configure")} code={npm.code} />
				</div>
			) : tab === "script" ? (
				<div key="script" className="animate-fade-in">
					<CodeBlock title="HTML" code={scriptTagSnippet({ dsn })} />
				</div>
			) : (
				<div key="http" className="animate-fade-in">
					<CodeBlock title="cURL" code={httpSnippet({ dsn })} />
				</div>
			)}
		</div>
	);
}
