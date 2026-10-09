import type { ProjectDto } from "@sentinel/shared";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Avatar } from "@/components/atoms/Avatar";
import { Badge } from "@/components/atoms/Badge";
import { Card } from "@/components/atoms/Card";
import { RelativeTime } from "./RelativeTime";

export function ProjectCard({
	project,
	orgSlug,
}: {
	project: ProjectDto;
	orgSlug: string;
}) {
	const { t } = useTranslation();
	const platform = project.platform;
	return (
		<Link
			to="/$orgSlug/projects/$projectSlug/issues"
			params={{ orgSlug, projectSlug: project.slug }}
			data-testid="project-card"
			className="group block focus-visible:rounded-lg"
		>
			<Card className="p-4 transition-colors group-hover:border-primary/50 group-hover:shadow-md">
				<div className="flex items-start gap-3">
					<Avatar name={project.name} className="size-9 text-xs" />
					<div className="min-w-0 flex-1">
						<div className="truncate text-sm font-semibold text-foreground">
							{project.name}
						</div>
						<div className="mt-1 flex items-center gap-2 text-xs text-muted">
							<Badge tone="neutral">
								{isPlatform(platform) ? t(`platforms.${platform}`) : platform}
							</Badge>
							<RelativeTime date={project.createdAt} />
						</div>
					</div>
				</div>
				<div className="mt-4 flex items-center gap-1 text-xs font-medium text-primary">
					{t("projects.open")}
					<ArrowRight
						aria-hidden
						className="size-3.5 transition-transform group-hover:translate-x-0.5"
					/>
				</div>
			</Card>
		</Link>
	);
}

const PLATFORM_KEYS = [
	"javascript",
	"react",
	"node",
	"react-native",
	"python",
	"other",
] as const;
function isPlatform(value: string): value is (typeof PLATFORM_KEYS)[number] {
	return (PLATFORM_KEYS as readonly string[]).includes(value);
}
