import { type HealthResponse, healthResponseSchema } from "@sentinel/shared";
import { useEffect, useState } from "react";

export function App() {
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
			{error && <p>API no disponible: {error}</p>}
			{health && (
				<p>
					API: {health.status} ({health.service}) — {health.timestamp}
				</p>
			)}
			{!health && !error && <p>Conectando con la API…</p>}
		</main>
	);
}
