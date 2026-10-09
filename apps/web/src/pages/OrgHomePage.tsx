import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Spinner } from "@/components/atoms/Spinner";
import { useProjects } from "@/hooks/useProjects/useProjects";
import { useCurrentOrganization } from "@/hooks/useScope/useScope";

/** Dentro de una organización: al primer proyecto si lo hay; si no, al listado de proyectos. */
export function OrgHomePage() {
	const navigate = useNavigate();
	const { organization } = useCurrentOrganization();
	const projects = useProjects(organization?.id);

	useEffect(() => {
		if (!organization || !projects.data) return;
		const first = projects.data[0];
		if (first) {
			navigate({
				to: "/$orgSlug/projects/$projectSlug/issues",
				params: { orgSlug: organization.slug, projectSlug: first.slug },
				replace: true,
			});
		} else {
			navigate({
				to: "/$orgSlug/projects",
				params: { orgSlug: organization.slug },
				replace: true,
			});
		}
	}, [organization, projects.data, navigate]);

	return (
		<div className="flex min-h-full items-center justify-center">
			<Spinner className="size-6" />
		</div>
	);
}
