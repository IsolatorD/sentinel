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

/** Transacción con un span, con valores por defecto razonables. */
export function transaction(
	over: {
		name?: string;
		durationMs?: number;
		timestamp?: string;
		traceId?: string;
		transactionId?: string;
		status?: string;
		user?: string;
		release?: string;
		environment?: string;
		measurements?: Record<string, { value: number; unit?: string }>;
		spans?: unknown[];
	} = {},
) {
	return {
		...(over.transactionId && { transaction_id: over.transactionId }),
		trace_id: over.traceId ?? "4bf92f3577b34da6a3ce929d0e0e4736",
		span_id: "00f067aa0ba902b7",
		name: over.name ?? "/checkout",
		op: "pageload",
		duration_ms: over.durationMs ?? 1200,
		status: over.status ?? "ok",
		release: over.release ?? "1.0.0",
		environment: over.environment ?? "prod",
		...(over.timestamp && { timestamp: over.timestamp }),
		...(over.user && { user: { id: over.user } }),
		...(over.measurements && { measurements: over.measurements }),
		spans: over.spans ?? [
			{
				span_id: "b9c7c989f97918e1",
				parent_span_id: "00f067aa0ba902b7",
				op: "http.client",
				description: "GET /api/cart",
				start_timestamp: over.timestamp ?? minutesAgo(5),
				duration_ms: 300,
			},
		],
	};
}

/** ISO de hace N minutos (los eventos con fecha futura se recortan a la de recepción). */
export const minutesAgo = (n: number) =>
	new Date(Date.now() - n * 60_000).toISOString();

export type { Session };
