import { projectDtoSchema, publicConfigSchema } from "@sentinel/shared";
import { describe, expect, inject, it } from "vitest";
import { Api, PASSWORD, Session } from "../support/api-client.js";
import { scalar } from "../support/db.js";
import { api as mainApi } from "../support/factories.js";

/*
 * Una instancia abierta al público: la tercera API de las pruebas (misma base de datos y mismo
 * secreto) tiene el registro cerrado y límites por defecto para los proyectos nuevos.
 */
const locked = () => new Api(inject("e2e").lockedBaseUrl);

describe("registro cerrado (SIGNUP_ENABLED=false)", () => {
	it("la configuración pública lo anuncia, y la principal sigue abierta", async () => {
		const closed = publicConfigSchema.parse(
			(await locked().get("/api/config")).json,
		);
		expect(closed.signUpEnabled).toBe(false);
		const open = publicConfigSchema.parse(
			(await mainApi().get("/api/config")).json,
		);
		expect(open.signUpEnabled).toBe(true);
	});

	it("no se puede crear una cuenta nueva, y no queda rastro", async () => {
		const email = `closed-${Date.now()}@e2e.test`;
		const res = await locked().post(
			"/api/auth/sign-up/email",
			{ name: "Intruso", email, password: PASSWORD },
			new Session(email, "Intruso"),
		);
		expect(res.status).toBeGreaterThanOrEqual(400);
		expect(res.status).toBeLessThan(500);
		expect(
			await scalar('select count(*) from "user" where email = $1', [email]),
		).toBe(0);
	});

	it("quien ya tiene cuenta sigue pudiendo entrar", async () => {
		const owner = await mainApi().signUp("antiguo");
		const res = await locked().post(
			"/api/auth/sign-in/email",
			{ email: owner.email, password: PASSWORD },
			new Session(owner.email, "antiguo"),
		);
		expect(res.status).toBe(200);
	});
});

describe("valores por defecto de los proyectos nuevos", () => {
	it("con DEFAULT_* configurados, un proyecto nace acotado; sin ellos, como siempre", async () => {
		const client = mainApi();
		const owner = await client.signUp("owner");
		const orgId = await client.createOrganization(owner, "Defaults");

		const limited = projectDtoSchema.parse(
			(
				await locked().post(
					`/api/organizations/${orgId}/projects`,
					{ name: "Acotado" },
					owner,
				)
			).json,
		);
		expect(limited).toMatchObject({
			retentionDays: 30,
			monthlyEventQuota: 1234,
			monthlyTransactionQuota: 567,
		});

		const plain = projectDtoSchema.parse(
			(
				await client.post(
					`/api/organizations/${orgId}/projects`,
					{ name: "Normal" },
					owner,
				)
			).json,
		);
		expect(plain).toMatchObject({
			retentionDays: 90,
			monthlyEventQuota: null,
			monthlyTransactionQuota: null,
		});
	});

	it("el administrador puede cambiarlos después, como cualquier otro límite", async () => {
		const client = mainApi();
		const owner = await client.signUp("owner");
		const orgId = await client.createOrganization(owner, "Cambio");
		const project = projectDtoSchema.parse(
			(
				await locked().post(
					`/api/organizations/${orgId}/projects`,
					{ name: "Acotado" },
					owner,
				)
			).json,
		);
		const patched = projectDtoSchema.parse(
			(
				await client.patch(
					`/api/organizations/${orgId}/projects/${project.id}`,
					{ monthlyEventQuota: null, retentionDays: 180 },
					owner,
				)
			).json,
		);
		expect(patched).toMatchObject({
			retentionDays: 180,
			monthlyEventQuota: null,
			monthlyTransactionQuota: 567,
		});
	});
});
