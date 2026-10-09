import type { TabBarProps } from "@/components/molecules/TabBar/TabBarInterface";
import { cn } from "@/utils/cn/cn";

export function TabBar({ tabs, active, onChange, label }: TabBarProps) {
	return (
		<div
			role="tablist"
			aria-label={label}
			className="flex gap-4 border-b border-border"
		>
			{tabs.map((tab) => (
				<button
					key={tab.id}
					type="button"
					role="tab"
					aria-selected={active === tab.id}
					onClick={() => onChange(tab.id)}
					className={cn(
						"-mb-px border-b-2 px-0.5 pb-2 text-sm font-medium",
						active === tab.id
							? "border-primary text-foreground"
							: "border-transparent text-muted hover:text-foreground",
					)}
				>
					{tab.label}
				</button>
			))}
		</div>
	);
}
