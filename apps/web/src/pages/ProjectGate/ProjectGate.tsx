import type { ReactNode } from "react";
import { Spinner } from "@/components/atoms/Spinner/Spinner";
import { ErrorState } from "@/components/molecules/ErrorState/ErrorState";
import { useCurrentProject } from "@/hooks/useScope/useScope";
import { NotFoundPage } from "@/pages/NotFoundPage/NotFoundPage";

/** Espera a resolver el proyecto de la URL antes de mostrar su contenido. */
export function ProjectGate({ children }: { children: ReactNode }) {
	const { project, isLoading, isError, notFound } = useCurrentProject();
	if (isError) return <ErrorState />;
	if (notFound) return <NotFoundPage />;
	if (isLoading || !project) {
		return (
			<div className="flex min-h-64 items-center justify-center">
				<Spinner className="size-6" />
			</div>
		);
	}
	return <>{children}</>;
}
