import { useParams } from "@tanstack/react-router";
import { useOrganizations } from "@/hooks/useOrganizations/useOrganizations";
import { useProjects } from "@/hooks/useProjects/useProjects";

/** Organización de la URL (`/$orgSlug/...`), resuelta contra las organizaciones del usuario. */
export function useCurrentOrganization() {
	const { orgSlug } = useParams({ strict: false }) as { orgSlug?: string };
	const query = useOrganizations();
	const organization = query.data?.find((o) => o.slug === orgSlug);
	return {
		organization,
		organizations: query.data ?? [],
		isLoading: query.isLoading,
		isError: query.isError,
		/** La lista cargó pero la organización de la URL no está en ella. */
		notFound: Boolean(orgSlug) && query.isSuccess && !organization,
	};
}

/** Proyecto de la URL (`/$orgSlug/projects/$projectSlug/...`), resuelto contra los de la organización. */
export function useCurrentProject() {
	const { projectSlug } = useParams({ strict: false }) as {
		projectSlug?: string;
	};
	const { organization } = useCurrentOrganization();
	const query = useProjects(organization?.id);
	const project = query.data?.find((p) => p.slug === projectSlug);
	return {
		organization,
		project,
		projects: query.data ?? [],
		isLoading: query.isLoading,
		isError: query.isError,
		notFound: Boolean(projectSlug) && query.isSuccess && !project,
		/** Alcance listo para las consultas de issues. */
		scope: { orgId: organization?.id, projectId: project?.id },
	};
}
