import { inject } from "vitest";
import { Api, type Session } from "./api-client.js";

export const api = () => new Api(inject("e2e").baseUrl);

/** Un tenant completo: dueño, organización y un proyecto con su clave. */
export async function createTenant(client: Api = api()) {
	const owner = await client.signUp("owner");
	const orgId = await client.createOrganization(owner, "Acme");
	const project = await client.createProject(owner, orgId, "App");
	return {
		client,
		owner,
		orgId,
		projectId: project.id,
		key: project.keys[0].publicKey,
		keyId: project.keys[0].id,
		dsn: project.keys[0].dsn,
		projectPath: `/api/organizations/${orgId}/projects/${project.id}`,
	};
}

export type Tenant = Awaited<ReturnType<typeof createTenant>>;

/** Evento de error con stacktrace, con valores por defecto razonables. */
export function errorEvent(
	over: {
		type?: string;
		value?: string;
		fn?: string;
		user?: string;
		timestamp?: string;
		release?: string;
		environment?: string;
		eventId?: string;
		message?: string;
	} = {},
) {
	return {
		...(over.eventId && { event_id: over.eventId }),
		level: "error",
		...(over.timestamp && { timestamp: over.timestamp }),
		release: over.release ?? "1.0.0",
		environment: over.environment ?? "prod",
		...(over.user && { user: { id: over.user } }),
		exception: {
			values: [
				{
					type: over.type ?? "TypeError",
					value: over.value ?? "x is undefined",
					stacktrace: {
						frames: [
							{
								filename: "https://app.example.com/assets/Cart.js",
								function: over.fn ?? "computeTotal",
								lineno: 10,
								in_app: true,
							},
						],
					},
				},
			],
		},
	};
}

/** ISO de hace N minutos (los eventos con fecha futura se recortan a la de recepción). */
export const minutesAgo = (n: number) =>
	new Date(Date.now() - n * 60_000).toISOString();

export type { Session };
