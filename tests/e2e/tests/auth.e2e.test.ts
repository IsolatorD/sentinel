import { errorResponseSchema, publicConfigSchema } from "@sentinel/shared";
import { describe, expect, it } from "vitest";
import { PASSWORD, Session } from "../support/api-client.js";
import { api } from "../support/factories.js";

describe("autenticación (Better Auth)", () => {
	it("registrarse deja una sesión por cookie que identifica al usuario", async () => {
		const client = api();
		const user = await client.signUp("ana");

		const res = await client.get("/api/auth/get-session", user);
		expect(res.status).toBe(200);
		expect(res.json.user).toMatchObject({ email: user.email, name: "ana" });
		expect(user.cookieHeader).toContain("better-auth.session_token");
	});

	it("iniciar sesión: contraseña correcta 200, incorrecta 401", async () => {
		const client = api();
		const user = await client.signUp("login");

		const ok = await client.post("/api/auth/sign-in/email", {
			email: user.email,
			password: PASSWORD,
		});
		expect(ok.status).toBe(200);
		const bad = await client.post("/api/auth/sign-in/email", {
			email: user.email,
			password: "otra-clave-123",
		});
		expect(bad.status).toBe(401);
	});

	it("rechaza un email repetido y una contraseña demasiado corta", async () => {
		const client = api();
		const user = await client.signUp("dup");

		const dup = await client.post("/api/auth/sign-up/email", {
			name: "dup",
			email: user.email,
			password: PASSWORD,
		});
		expect(dup.status).toBeGreaterThanOrEqual(400);
		expect(dup.status).toBeLessThan(500);

		const short = await client.post("/api/auth/sign-up/email", {
			name: "x",
			email: `short-${Date.now()}@e2e.test`,
			password: "corta",
		});
		expect(short.status).toBe(400);
	});

	it("una petición desde un origen no confiable se rechaza (CSRF)", async () => {
		const client = api();
		const user = await client.signUp("csrf");
		const res = await client.post(
			"/api/auth/organization/create",
			{ name: "X", slug: `x-${Date.now()}` },
			user,
			{ origin: "https://sitio-malicioso.example" },
		);
		expect(res.status).toBe(403);
	});

	it("cerrar sesión invalida la sesión", async () => {
		const client = api();
		const user = await client.signUp("logout");
		const out = await client.post("/api/auth/sign-out", {}, user);
		expect(out.status).toBe(200);

		const fresh = new Session(user.email, user.name);
		const res = await client.get("/api/auth/get-session", fresh);
		expect(res.json).toBeNull();
	});

	it("quien crea una organización queda como owner; invitar y aceptar añade miembros", async () => {
		const client = api();
		const owner = await client.signUp("owner");
		const invitee = await client.signUp("invitee");
		const orgId = await client.createOrganization(owner);
		await client.addMember(owner, orgId, invitee, "member");

		const org = await client.get(
			`/api/auth/organization/get-full-organization?organizationId=${orgId}`,
			owner,
		);
		expect(
			org.json.members.map((m: { role: string }) => m.role).sort(),
		).toEqual(["member", "owner"]);
	});
});

describe("convenciones de la API", () => {
	it("los errores siguen el formato único e incluyen el id de la petición", async () => {
		const res = await api().get("/api/organizations/cualquiera/projects");
		expect(res.status).toBe(401);
		const body = errorResponseSchema.parse(res.json);
		expect(body).toMatchObject({ statusCode: 401, code: "UNAUTHORIZED" });
		expect(body.requestId).toBe(res.headers.get("x-request-id"));
	});

	it("respeta el x-request-id entrante y lo devuelve", async () => {
		const res = await api().get("/api/health", undefined, {
			headers: { "x-request-id": "trace-e2e-123" },
		});
		expect(res.headers.get("x-request-id")).toBe("trace-e2e-123");
	});

	it("genera un x-request-id si el entrante no es seguro", async () => {
		const res = await api().get("/api/health", undefined, {
			headers: { "x-request-id": "con espacios no válidos" },
		});
		expect(res.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
	});

	it("un JSON mal formado da 400, tanto en rutas de la app como en las de auth", async () => {
		const client = api();
		const user = await client.signUp("json");
		const a = await client.request("/api/auth/sign-in/email", {
			method: "POST",
			rawBody: '{"email":',
		});
		expect(a.status).toBe(400);
		const b = await client.request("/api/organizations/x/projects", {
			method: "POST",
			rawBody: '{"name":',
			session: user,
		});
		expect(b.status).toBe(400);
		expect(errorResponseSchema.parse(b.json).message).toBe("Invalid JSON body");
	});

	it("un DELETE con Content-Type JSON y sin cuerpo no se rechaza como JSON vacío", async () => {
		const client = api();
		const user = await client.signUp("del");
		const orgId = await client.createOrganization(user);
		const project = await client.createProject(user, orgId);
		const res = await client.request(
			`/api/organizations/${orgId}/projects/${project.id}`,
			{
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				session: user,
			},
		);
		expect(res.status).toBe(204);
	});
});

describe("configuración pública", () => {
	it("informa qué proveedores de login hay, sin exponer secretos", async () => {
		const res = await api().get("/api/config");
		expect(res.status).toBe(200);
		// El servidor de pruebas no tiene credenciales de Google y sí un SMTP de captura.
		expect(publicConfigSchema.parse(res.json)).toEqual({
			authProviders: { google: false },
			emailEnabled: true,
			emailVerification: false,
			signUpEnabled: true,
			monitoringDsn: null,
		});
		expect(res.text).not.toMatch(/secret|client/i);
	});
});

describe("documentación", () => {
	it("publica el OpenAPI, la UI de Swagger y la referencia de Better Auth", async () => {
		const client = api();
		const spec = await client.get("/api/docs/openapi.json");
		expect(spec.status).toBe(200);
		expect(spec.json.openapi).toMatch(/^3\./);
		const paths = Object.keys(spec.json.paths);
		expect(paths).toEqual(
			expect.arrayContaining([
				"/api/health",
				"/api/{projectId}/events",
				"/api/organizations/{orgId}/projects",
				"/api/organizations/{orgId}/projects/{projectId}/issues",
			]),
		);

		expect((await client.get("/api/docs")).status).toBe(200);
		expect((await client.get("/api/auth/reference")).status).toBe(200);
	});

	it("documenta los parámetros de query del listado de issues", async () => {
		const spec = await api().get("/api/docs/openapi.json");
		const op =
			spec.json.paths["/api/organizations/{orgId}/projects/{projectId}/issues"]
				.get;
		const query = op.parameters
			.filter((p: { in: string }) => p.in === "query")
			.map((p: { name: string }) => p.name);
		expect(query).toEqual(
			expect.arrayContaining([
				"status",
				"level",
				"q",
				"sort",
				"order",
				"limit",
				"offset",
			]),
		);
	});
});
