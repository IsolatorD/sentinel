import { type HealthResponse, healthResponseSchema } from "@sentinel/shared";
import { useEffect, useState } from "react";
import { AuthPage } from "./AuthPage";
import { authClient } from "./auth-client";

export function App() {
	const { data: session, isPending } = authClient.useSession();
	const [health, setHealth] = useState<HealthResponse | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		fetch("/api/health")
			.then((res) => res.json())
			.then((data) => setHealth(healthResponseSchema.parse(data)))
			.catch((err: Error) => setError(err.message));
	}, []);

	return (
		<main style={{ fontFamily: "system-ui", padding: 32 }}>
			<h1>Sentinel</h1>
			<p style={{ color: "gray" }}>
				{error
					? `API no disponible: ${error}`
					: `API: ${health?.status ?? "…"}`}
			</p>
			{isPending && <p>Cargando sesión…</p>}
			{!isPending && !session && <AuthPage />}
			{session && (
				<div>
					<p>
						Sesión iniciada como <b>{session.user.name}</b> (
						{session.user.email})
					</p>
					<button type="button" onClick={() => authClient.signOut()}>
						Cerrar sesión
					</button>
				</div>
			)}
		</main>
	);
}
