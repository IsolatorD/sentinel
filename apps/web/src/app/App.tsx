import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { useMemo } from "react";
import { createQueryClient } from "./query-client";
import { createAppRouter } from "./router";

export function App() {
	const queryClient = useMemo(() => createQueryClient(), []);
	const router = useMemo(() => createAppRouter(queryClient), [queryClient]);
	return (
		<QueryClientProvider client={queryClient}>
			<RouterProvider router={router} />
		</QueryClientProvider>
	);
}
