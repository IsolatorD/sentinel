import { randomUUID } from "node:crypto";
import type { z } from "zod";

// Origen que la API acepta como dashboard (WEB_ORIGIN del servidor de pruebas).
const DASHBOARD_ORIGIN = "http://localhost:5173";
export const PASSWORD = "Passw0rd-e2e-123";

export interface ApiResponse {
	status: number;
	headers: Headers;
	text: string;
	// biome-ignore lint/suspicious/noExplicitAny: cuerpo JSON arbitrario de las respuestas
	json: any;
}

export interface RequestOptions {
	method?: string;
	body?: unknown;
	/** Cuerpo ya serializado (para probar JSON roto). */
	rawBody?: string;
	/** `manual` devuelve la redirección en lugar de seguirla (para leer sus cookies). */
	redirect?: "manual";
	/** Cuerpo binario (subida de source maps). */
	binary?: Uint8Array;
	session?: Session;
	headers?: Record<string, string>;
	origin?: string | null;
}

/** Usuario autenticado: guarda las cookies de sesión de Better Auth. */
export class Session {
	private cookies = new Map<string, string>();

	constructor(
		readonly email: string,
		readonly name: string,
	) {}

	storeFrom(headers: Headers) {
		for (const line of headers.getSetCookie()) {
			const [pair] = line.split(";");
			const eq = pair.indexOf("=");
			this.cookies.set(pair.slice(0, eq), pair.slice(eq + 1));
		}
	}

	get cookieHeader(): string {
		return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
	}

	clearCookies() {
		this.cookies.clear();
	}
}

export class Api {
	constructor(readonly baseUrl: string) {}

	async request(
		path: string,
		options: RequestOptions = {},
	): Promise<ApiResponse> {
		const headers: Record<string, string> = { ...options.headers };
		if (options.body !== undefined || options.rawBody !== undefined) {
			headers["Content-Type"] ??= "application/json";
		}
		if (options.origin !== null)
			headers.Origin = options.origin ?? DASHBOARD_ORIGIN;
		if (options.session?.cookieHeader)
			headers.Cookie = options.session.cookieHeader;

		const res = await fetch(`${this.baseUrl}${path}`, {
			method: options.method ?? (options.body !== undefined ? "POST" : "GET"),
			headers,
			redirect: options.redirect,
			body:
				(options.binary as BodyInit | undefined) ??
				options.rawBody ??
				(options.body !== undefined ? JSON.stringify(options.body) : undefined),
		});
		options.session?.storeFrom(res.headers);

		const text = await res.text();
		let json: unknown;
		try {
			json = text ? JSON.parse(text) : undefined;
		} catch {
			json = undefined;
		}
		return { status: res.status, headers: res.headers, text, json };
	}

	get = (path: string, session?: Session, extra: RequestOptions = {}) =>
		this.request(path, { ...extra, method: "GET", session });
	post = (
		path: string,
		body: unknown,
		session?: Session,
		extra: RequestOptions = {},
	) => this.request(path, { ...extra, method: "POST", body, session });
	patch = (
		path: string,
		body: unknown,
		session?: Session,
		extra: RequestOptions = {},
	) => this.request(path, { ...extra, method: "PATCH", body, session });
	delete = (path: string, session?: Session, extra: RequestOptions = {}) =>
		this.request(path, { ...extra, method: "DELETE", session });

	/** Sube un archivo binario (`application/octet-stream`), como lo hace la CLI. */
	putBinary = (
		path: string,
		binary: Uint8Array | string,
		extra: RequestOptions = {},
	) =>
		this.request(path, {
			origin: null,
			...extra,
			method: "PUT",
			binary: typeof binary === "string" ? Buffer.from(binary) : binary,
			headers: { "Content-Type": "application/octet-stream", ...extra.headers },
		});

	// ---------- Atajos ----------

	/** Crea un usuario nuevo (email único) y lo deja autenticado. */
	async signUp(label = "user"): Promise<Session> {
		const email = `${label}-${randomUUID().slice(0, 8)}@e2e.test`;
		const session = new Session(email, label);
		const res = await this.post(
			"/api/auth/sign-up/email",
			{ name: label, email, password: PASSWORD },
			session,
		);
		if (res.status !== 200)
			throw new Error(`sign-up falló (${res.status}): ${res.text}`);
		return session;
	}

	async createOrganization(session: Session, name = "Org"): Promise<string> {
		const slug = `${name.toLowerCase()}-${randomUUID().slice(0, 8)}`;
		const res = await this.post(
			"/api/auth/organization/create",
			{ name, slug },
			session,
		);
		if (res.status !== 200)
			throw new Error(`crear organización falló (${res.status}): ${res.text}`);
		return res.json.id as string;
	}

	/** Invita a otro usuario a la organización y acepta la invitación (flujo real de Better Auth). */
	async addMember(
		owner: Session,
		orgId: string,
		member: Session,
		role: "member" | "admin" = "member",
	): Promise<void> {
		const invite = await this.post(
			"/api/auth/organization/invite-member",
			{ email: member.email, role, organizationId: orgId },
			owner,
		);
		if (invite.status !== 200)
			throw new Error(`invitar falló (${invite.status}): ${invite.text}`);
		const accept = await this.post(
			"/api/auth/organization/accept-invitation",
			{ invitationId: invite.json.id },
			member,
		);
		if (accept.status !== 200)
			throw new Error(`aceptar falló (${accept.status}): ${accept.text}`);
	}

	async createProject(session: Session, orgId: string, name = "App") {
		const res = await this.post(
			`/api/organizations/${orgId}/projects`,
			{ name },
			session,
		);
		if (res.status !== 201)
			throw new Error(`crear proyecto falló (${res.status}): ${res.text}`);
		return res.json as {
			id: string;
			keys: Array<{ id: string; publicKey: string; dsn: string }>;
		};
	}

	/** Envía un evento por el endpoint público de ingesta. */
	ingest(
		projectId: string,
		key: string | undefined,
		event: unknown,
		extra: RequestOptions = {},
	): Promise<ApiResponse> {
		return this.request(`/api/${projectId}/events`, {
			method: "POST",
			body: event,
			origin: null,
			...extra,
			headers: { ...(key ? { "X-Sentinel-Key": key } : {}), ...extra.headers },
		});
	}
}

/** Valida una respuesta contra su esquema Zod (el mismo que usan frontend y documentación). */
export function parseWith<S extends z.ZodType>(
	schema: S,
	value: unknown,
): z.infer<S> {
	return schema.parse(value);
}
