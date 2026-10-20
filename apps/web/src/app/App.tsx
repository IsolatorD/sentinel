import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { useMemo } from "react";
import { Toaster } from "sonner";
import { SelfMonitoring } from "@/components/organisms/SelfMonitoring/SelfMonitoring";
import { useTheme } from "@/hooks/useTheme/useTheme";
import { createQueryClient } from "./query-client";
import { createAppRouter } from "./router";

export function App() {
	const queryClient = useMemo(() => createQueryClient(), []);
	const router = useMemo(() => createAppRouter(queryClient), [queryClient]);
	const { theme } = useTheme();
	return (
		<QueryClientProvider client={queryClient}>
			<SelfMonitoring />
			<RouterProvider router={router} />
			{/* Avisos de operaciones completadas: abajo a la derecha, con los colores de la app. */}
			<Toaster
				theme={theme}
				position="bottom-right"
				closeButton
				visibleToasts={3}
				toastOptions={{ classNames: { toast: "sentinel-toast" } }}
			/>
		</QueryClientProvider>
	);
}
