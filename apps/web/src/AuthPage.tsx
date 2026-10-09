import { type FormEvent, useState } from "react";
import { authClient } from "./auth-client";

export function AuthPage() {
	const [mode, setMode] = useState<"signin" | "signup">("signin");
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	async function onSubmit(e: FormEvent) {
		e.preventDefault();
		setError(null);
		setLoading(true);
		const result =
			mode === "signup"
				? await authClient.signUp.email({ name, email, password })
				: await authClient.signIn.email({ email, password });
		setLoading(false);
		if (result.error) setError(result.error.message ?? "Error desconocido");
	}

	return (
		<form
			onSubmit={onSubmit}
			style={{ display: "grid", gap: 12, maxWidth: 320 }}
		>
			<h2>{mode === "signin" ? "Iniciar sesión" : "Crear cuenta"}</h2>
			{mode === "signup" && (
				<input
					placeholder="Nombre"
					value={name}
					onChange={(e) => setName(e.target.value)}
					required
				/>
			)}
			<input
				type="email"
				placeholder="Email"
				value={email}
				onChange={(e) => setEmail(e.target.value)}
				required
			/>
			<input
				type="password"
				placeholder="Contraseña (mín. 8)"
				value={password}
				onChange={(e) => setPassword(e.target.value)}
				minLength={8}
				required
			/>
			{error && <p style={{ color: "crimson", margin: 0 }}>{error}</p>}
			<button type="submit" disabled={loading}>
				{mode === "signin" ? "Entrar" : "Registrarme"}
			</button>
			<button
				type="button"
				onClick={() => authClient.signIn.social({ provider: "google" })}
			>
				Continuar con Google
			</button>
			<button
				type="button"
				onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
			>
				{mode === "signin"
					? "¿No tenés cuenta? Registrate"
					: "¿Ya tenés cuenta? Iniciá sesión"}
			</button>
		</form>
	);
}
