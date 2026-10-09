import { randomUUID } from "node:crypto";
import { describe, expect, inject, it } from "vitest";
import { Api, PASSWORD, Session } from "../support/api-client.js";
import { db } from "../support/db.js";
import { eventually } from "../support/eventually.js";
import { mails } from "../support/mailbox.js";

// Esta API exige verificar el correo antes de entrar (la principal de las pruebas no).
const api = () => new Api(inject("e2e").verifyBaseUrl);
const CALLBACK = "http://localhost:5173/email-verified";

const mailTo = (email: string) => mails().filter((m) => m.to.includes(email));

async function register(
	client: Api,
	name = "Ana",
	headers: Record<string, string> = {},
) {
	const email = `verif-${randomUUID().slice(0, 8)}@e2e.test`;
	const session = new Session(email, name);
	const res = await client.post(
		"/api/auth/sign-up/email",
		{ name, email, password: PASSWORD, callbackURL: CALLBACK },
		session,
		{ headers },
	);
	return { email, session, res };
}

/** Enlace de verificación de un correo, como ruta de la API (lo que abriría el navegador). */
function linkOf(email: string, index = 0): string {
	const url = /https?:\/\/\S+verify-email\S+/.exec(
		mailTo(email)[index].text,
	)?.[0];
	if (!url) throw new Error("el correo no trae enlace de verificación");
	const parsed = new URL(url);
	return `${parsed.pathname}${parsed.search}`;
}

const emailVerified = async (email: string) =>
	(
		await db().query('select email_verified from "user" where email = $1', [
			email,
		])
	).rows[0]?.email_verified as boolean;

describe("verificación de cuenta", () => {
	it("la configuración pública lo indica", async () => {
		const res = await api().get("/api/config");
		expect(res.json).toMatchObject({
			emailVerification: true,
			emailEnabled: true,
		});
	});

	it("al registrarse no hay sesión y llega un correo con el enlace", async () => {
		const client = api();
		const { email, session, res } = await register(client);
		expect(res.status, res.text).toBe(200);
		// Sin verificar no se entra: no se crea sesión.
		expect(
			(await client.get("/api/auth/get-session", session)).json,
		).toBeNull();
		expect(await emailVerified(email)).toBe(false);

		await eventually(async () => expect(mailTo(email)).toHaveLength(1));
		const [mail] = mailTo(email);
		expect(mail.subject).toBe("Verify your email address");
		expect(mail.text).toContain("Hi Ana");
		expect(mail.html).toContain("Verify my email");
		expect(linkOf(email)).toMatch(/^\/api\/auth\/verify-email\?token=/);
	});

	it("el correo sale en el idioma del navegador de quien se registra", async () => {
		const { email } = await register(api(), "Lucía", {
			"Accept-Language": "es-AR,es;q=0.9",
		});
		await eventually(async () => expect(mailTo(email)).toHaveLength(1));
		expect(mailTo(email)[0].subject).toBe("Verifica tu correo electrónico");
		expect(mailTo(email)[0].text).toContain("Hola Lucía");
	});

	it("intentar entrar sin verificar se rechaza y manda un enlace nuevo", async () => {
		const client = api();
		const { email, session } = await register(client);
		await eventually(async () => expect(mailTo(email)).toHaveLength(1));

		const login = await client.post(
			"/api/auth/sign-in/email",
			{ email, password: PASSWORD, callbackURL: CALLBACK },
			session,
		);
		expect(login.status).toBe(403);
		expect(login.json.code).toBe("EMAIL_NOT_VERIFIED");
		await eventually(async () => expect(mailTo(email)).toHaveLength(2));
	});

	it("abrir el enlace verifica la cuenta, inicia sesión y redirige al panel", async () => {
		const client = api();
		const { email, session } = await register(client);
		await eventually(async () => expect(mailTo(email)).toHaveLength(1));

		const res = await client.request(linkOf(email), {
			session,
			redirect: "manual",
			origin: null,
		});
		expect(res.status).toBe(302);
		expect(res.headers.get("location")).toBe(CALLBACK);
		expect(await emailVerified(email)).toBe(true);

		// La sesión quedó iniciada con la cookie de esa misma respuesta.
		const me = await client.get("/api/auth/get-session", session);
		expect(me.json.user).toMatchObject({ email, emailVerified: true });
	});

	it("una vez verificada, entra con su contraseña como cualquiera", async () => {
		const client = api();
		const { email, session } = await register(client);
		await eventually(async () => expect(mailTo(email)).toHaveLength(1));
		await client.request(linkOf(email), {
			session,
			redirect: "manual",
			origin: null,
		});

		const fresh = new Session(email, "Ana");
		const login = await client.post(
			"/api/auth/sign-in/email",
			{ email, password: PASSWORD },
			fresh,
		);
		expect(login.status, login.text).toBe(200);
		const org = await client.post(
			"/api/auth/organization/create",
			{ name: "Acme", slug: `acme-${randomUUID().slice(0, 8)}` },
			fresh,
		);
		expect(org.status).toBe(200);
	});

	it("un enlace manipulado no verifica nada", async () => {
		const client = api();
		const { email, session } = await register(client);
		await eventually(async () => expect(mailTo(email)).toHaveLength(1));
		const link = linkOf(email);
		const tampered = link.replace(
			/token=([^&]+)/,
			(_m, t: string) => `token=${t.slice(0, -3)}xyz`,
		);

		const res = await client.request(tampered, {
			session,
			redirect: "manual",
			origin: null,
		});
		expect(res.status).toBe(302);
		expect(res.headers.get("location")).toMatch(/[?&]error=/);
		expect(await emailVerified(email)).toBe(false);
		expect(
			(await client.get("/api/auth/get-session", session)).json,
		).toBeNull();
	});

	it("se puede pedir el correo de nuevo", async () => {
		const client = api();
		const { email, session } = await register(client);
		await eventually(async () => expect(mailTo(email)).toHaveLength(1));
		const resend = await client.post(
			"/api/auth/send-verification-email",
			{ email, callbackURL: CALLBACK },
			session,
		);
		expect(resend.status, resend.text).toBe(200);
		await eventually(async () => expect(mailTo(email)).toHaveLength(2));
	});

	it("pedirlo para una dirección que no existe responde igual y no envía nada (no revela quién tiene cuenta)", async () => {
		const client = api();
		const ghost = `fantasma-${randomUUID().slice(0, 8)}@e2e.test`;
		const res = await client.post(
			"/api/auth/send-verification-email",
			{ email: ghost, callbackURL: CALLBACK },
			new Session(ghost, "x"),
		);
		expect(res.status).toBe(200);
		await new Promise((r) => setTimeout(r, 500));
		expect(mailTo(ghost)).toHaveLength(0);
	});
});

describe("la API principal de las pruebas no lo exige", () => {
	it("se registra y entra en un solo paso, y la configuración lo refleja", async () => {
		const main = new Api(inject("e2e").baseUrl);
		expect((await main.get("/api/config")).json.emailVerification).toBe(false);
		const session = await main.signUp("directo");
		expect(
			(await main.get("/api/auth/get-session", session)).json.user.email,
		).toBe(session.email);
	});
});
