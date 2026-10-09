import { Navigate, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { Spinner } from "@/components/atoms/Spinner";
import { ErrorState } from "@/components/molecules/ErrorState";
import { Sidebar } from "@/components/organisms/Sidebar";
import { AppShellTemplate } from "@/components/templates/AppShellTemplate";
import { useCurrentOrganization } from "@/hooks/useScope/useScope";
import { useSession } from "@/hooks/useSession/useSession";
import { writeStorage } from "@/utils/storage/storage";
import { LAST_ORG_KEY } from "@/utils/storage/storage.constants";
import { NotFoundPage } from "./NotFoundPage";

/** Marco de la app para una organización: barra lateral y contenido. */
export function OrgLayoutPage() {
	const session = useSession();
	const { organization, isLoading, isError, notFound } =
		useCurrentOrganization();

	useEffect(() => {
		if (organization) writeStorage(LAST_ORG_KEY, organization.slug);
	}, [organization]);

	// La sesión expiró mientras se usaba la app.
	if (session.isSuccess && !session.data)
		return <Navigate to="/login" replace />;
	if (isError) return <ErrorState />;
	if (notFound) return <NotFoundPage />;
	if (isLoading || !organization) {
		return (
			<div className="flex min-h-full items-center justify-center">
				<Spinner className="size-6" />
			</div>
		);
	}

	return (
		<AppShellTemplate sidebar={<Sidebar />}>
			<Outlet />
		</AppShellTemplate>
	);
}
