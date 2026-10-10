import { useRouter } from "@tanstack/react-router";
import { AlertTriangle, WifiOff } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/atoms/Button/Button";
import { Logo } from "@/components/atoms/Logo/Logo";
import { EmptyState } from "@/components/molecules/EmptyState/EmptyState";
import { RETRY_EVERY_MS } from "@/pages/RouteErrorPage/RouteErrorPage.constants";
import { isConnectionError } from "@/utils/connection/connection";

/**
 * Lo que se ve cuando una ruta falla al cargar. El caso típico: la API no contesta (arrancando, apagada,
 * sin red). Entonces se explica en lugar de mostrar un error técnico, y se vuelve a intentar sola hasta
 * que responda.
 */
export function RouteErrorPage({ error }: { error: unknown }) {
	const { t } = useTranslation();
	const router = useRouter();
	const offline = isConnectionError(error);

	useEffect(() => {
		if (!offline) return;
		const timer = setInterval(() => router.invalidate(), RETRY_EVERY_MS);
		return () => clearInterval(timer);
	}, [offline, router]);

	return (
		<div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-6">
			<Logo />
			<EmptyState
				icon={offline ? WifiOff : AlertTriangle}
				title={t(
					offline ? "routeError.offline.title" : "routeError.generic.title",
				)}
				description={t(
					offline
						? "routeError.offline.description"
						: "routeError.generic.description",
				)}
				action={
					<Button variant="primary" onClick={() => router.invalidate()}>
						{t("common.retry")}
					</Button>
				}
			/>
		</div>
	);
}
