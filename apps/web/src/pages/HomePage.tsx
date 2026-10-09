import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Spinner } from "@/components/atoms/Spinner";
import { useOrganizations } from "@/hooks/use-organizations";
import { readStorage } from "@/utils/storage/storage";
import { LAST_ORG_KEY } from "@/utils/storage/storage.constants";

/** Punto de entrada: lleva a la última organización usada, o al alta si todavía no hay ninguna. */
export function HomePage() {
	const navigate = useNavigate();
	const organizations = useOrganizations();

	useEffect(() => {
		const list = organizations.data;
		if (!list) return;
		if (list.length === 0) {
			navigate({ to: "/onboarding", replace: true });
			return;
		}
		const last = readStorage(LAST_ORG_KEY);
		const target = list.find((o) => o.slug === last) ?? list[0];
		navigate({
			to: "/$orgSlug",
			params: { orgSlug: target.slug },
			replace: true,
		});
	}, [organizations.data, navigate]);

	return (
		<div className="flex min-h-full items-center justify-center">
			<Spinner className="size-6" />
		</div>
	);
}
