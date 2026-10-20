import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authService } from "@/services/authService/authService";
import { configService } from "@/services/configService/configService";
import * as fx from "@/test/fixtures";
import { mockHappyPath, renderApp } from "@/test/render-app";
import { ApiError } from "@/utils/apiError/apiError";

vi.mock("@/services/authService/authService");
vi.mock("@/services/configService/configService");
vi.mock("@/services/organizationsService/organizationsService");
vi.mock("@/services/projectsService/projectsService");
vi.mock("@/services/issuesService/issuesService");

const ORIGIN = window.location.origin;

beforeEach(() => {
	vi.resetAllMocks();
	mockHappyPath();
	vi.mocked(authService.getSession).mockResolvedValue(null);
	vi.mocked(configService.getPublicConfig).mockResolvedValue({
		authProviders: { google: false },
		emailEnabled: true,
		emailVerification: true,
		signUpEnabled: true,
	});
});

async function fillRegister(user: ReturnType<typeof renderApp>["user"]) {
	await user.type(await screen.findByLabelText("Full name"), "Ana Pérez");
	await user.type(screen.getByLabelText("Email"), "ana@example.com");
	await user.type(screen.getByLabelText("Password"), "una-clave-larga");
	await user.click(screen.getByRole("button", { name: "Create account" }));
}

describe("registro con verificación", () => {
	it("tras registrarse lleva a 'revisa tu correo', con la dirección y sin iniciar sesión", async () => {
		vi.mocked(authService.signUpEmail).mockResolvedValue({
			needsVerification: true,
		});
		const { user, router } = renderApp("/register");
		await fillRegister(user);

		expect(await screen.findByTestId("verify-email")).toHaveTextContent(
			"ana@example.com",
		);
		expect(router.state.location.pathname).toBe("/verify-email");
		expect(router.state.location.search).toMatchObject({
			email: "ana@example.com",
		});
		// El enlace del correo debe llevar a la pantalla de "correo verificado" de este mismo origen.
		expect(authService.signUpEmail).toHaveBeenCalledWith(
			{
				name: "Ana Pérez",
				email: "ana@example.com",
				password: "una-clave-larga",
			},
			`${ORIGIN}/email-verified`,
		);
	});

	it("conserva el destino original (p. ej. una invitación) en el enlace y en la pantalla", async () => {
		vi.mocked(authService.signUpEmail).mockResolvedValue({
			needsVerification: true,
		});
		const { user, router } = renderApp(
			"/register?redirect=%2Faccept-invitation%2Fabc",
		);
		await fillRegister(user);
		await screen.findByTestId("verify-email");
		expect(router.state.location.search).toMatchObject({
			redirect: "/accept-invitation/abc",
		});
		expect(authService.signUpEmail).toHaveBeenCalledWith(
			expect.anything(),
			`${ORIGIN}/email-verified?redirect=%2Faccept-invitation%2Fabc`,
		);
	});

	it("sin verificación (servidor sin correo) se entra directo, como antes", async () => {
		vi.mocked(authService.getSession)
			.mockResolvedValueOnce(null)
			.mockResolvedValue({ user: fx.user });
		vi.mocked(configService.getPublicConfig).mockResolvedValue({
			authProviders: { google: false },
			emailEnabled: false,
			emailVerification: false,
			signUpEnabled: true,
		});
		vi.mocked(authService.signUpEmail).mockResolvedValue({
			needsVerification: false,
		});
		const { user, router } = renderApp("/register");
		await fillRegister(user);
		await waitFor(() =>
			expect(router.state.location.pathname).not.toBe("/register"),
		);
		expect(router.state.location.pathname).not.toBe("/verify-email");
	});
});

describe("pantalla de revisar el correo", () => {
	it("permite reenviar el correo y espera antes de dejar pedirlo otra vez", async () => {
		vi.mocked(authService.sendVerificationEmail).mockResolvedValue(undefined);
		const { user } = renderApp("/verify-email?email=ana%40example.com");
		await user.click(
			await screen.findByRole("button", { name: "Resend the email" }),
		);
		expect(authService.sendVerificationEmail).toHaveBeenCalledWith(
			"ana@example.com",
			`${ORIGIN}/email-verified`,
		);
		const waiting = await screen.findByRole("button", {
			name: /Resend in \d+ s/,
		});
		expect(waiting).toBeDisabled();
	});

	it("si el reenvío falla, muestra el motivo que da el servidor", async () => {
		vi.mocked(authService.sendVerificationEmail).mockRejectedValue(
			new ApiError(
				429,
				"Demasiadas peticiones",
				"TOO_MANY_REQUESTS",
				undefined,
				undefined,
				"TOO_MANY_REQUESTS",
			),
		);
		const { user } = renderApp("/verify-email?email=ana%40example.com");
		await user.click(
			await screen.findByRole("button", { name: "Resend the email" }),
		);
		expect(
			await screen.findByText("Demasiadas peticiones"),
		).toBeInTheDocument();
	});

	it("sin dirección en la URL, explica qué hacer y no ofrece reenviar", async () => {
		renderApp("/verify-email");
		const card = await screen.findByTestId("verify-email");
		expect(card).toHaveTextContent(/Open the verification link/);
		expect(
			within(card).queryByRole("button", { name: "Resend the email" }),
		).not.toBeInTheDocument();
	});

	it("ignora un destino externo en la URL", async () => {
		renderApp(
			"/verify-email?email=a%40b.co&redirect=https%3A%2F%2Fevil.example.com",
		);
		const link = await screen.findByRole("link", { name: "Back to sign in" });
		expect(link.getAttribute("href")).not.toContain("evil");
	});
});

describe("entrar sin haber verificado", () => {
	it("explica el motivo y permite pedir otro correo a la dirección que se intentó", async () => {
		vi.mocked(authService.signInEmail).mockRejectedValue(
			new ApiError(403, "Verifica tu correo", "EMAIL_NOT_VERIFIED"),
		);
		vi.mocked(authService.sendVerificationEmail).mockResolvedValue(undefined);
		const { user } = renderApp("/login");
		await user.type(await screen.findByLabelText("Email"), "ana@example.com");
		await user.type(screen.getByLabelText("Password"), "una-clave-larga");
		await user.click(screen.getByRole("button", { name: "Sign in" }));

		const alert = await screen.findByRole("alert");
		expect(alert).toHaveTextContent("Verify your email address to sign in");
		await user.click(
			within(alert).getByRole("button", {
				name: "Resend the verification email",
			}),
		);
		expect(authService.sendVerificationEmail).toHaveBeenCalledWith(
			"ana@example.com",
			`${ORIGIN}/email-verified`,
		);
	});

	it("una contraseña incorrecta sigue mostrando el mensaje de siempre, sin ofrecer reenviar", async () => {
		vi.mocked(authService.signInEmail).mockRejectedValue(
			new ApiError(401, "Invalid email or password"),
		);
		const { user } = renderApp("/login");
		await user.type(await screen.findByLabelText("Email"), "ana@example.com");
		await user.type(screen.getByLabelText("Password"), "mala-clave");
		await user.click(screen.getByRole("button", { name: "Sign in" }));
		expect(
			await screen.findByText("Incorrect email or password."),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Resend the verification email" }),
		).not.toBeInTheDocument();
	});
});

describe("pantalla de correo verificado", () => {
	it("con éxito confirma y continúa al inicio", async () => {
		vi.mocked(authService.getSession).mockResolvedValue({ user: fx.user });
		const { user, router } = renderApp("/email-verified");
		expect(await screen.findByTestId("email-verified")).toHaveTextContent(
			"verified",
		);
		await user.click(
			screen.getByRole("button", { name: "Continue to Sentinel" }),
		);
		await waitFor(() =>
			expect(router.state.location.pathname).not.toBe("/email-verified"),
		);
	});

	it("continúa hacia el destino original, p. ej. la invitación", async () => {
		vi.mocked(authService.getSession).mockResolvedValue({ user: fx.user });
		const { user, router } = renderApp(
			"/email-verified?redirect=%2Faccept-invitation%2Fabc",
		);
		await user.click(
			await screen.findByRole("button", { name: "Continue to Sentinel" }),
		);
		await waitFor(() =>
			expect(router.state.location.pathname).toBe("/accept-invitation/abc"),
		);
	});

	it("un enlace caducado o inválido lo explica y deja pedir uno nuevo", async () => {
		vi.mocked(authService.sendVerificationEmail).mockResolvedValue(undefined);
		const expired = renderApp("/email-verified?error=token_expired");
		expect(
			await screen.findByText("This link has expired."),
		).toBeInTheDocument();
		expired.unmount();

		const { user } = renderApp("/email-verified?error=invalid_token");
		expect(
			await screen.findByText(/This link is not valid/),
		).toBeInTheDocument();
		const send = screen.getByRole("button", { name: "Send a new link" });
		expect(send).toBeDisabled();
		await user.type(screen.getByLabelText("Email"), "ana@example.com");
		await user.click(send);
		expect(authService.sendVerificationEmail).toHaveBeenCalledWith(
			"ana@example.com",
			`${ORIGIN}/email-verified`,
		);
	});

	it("un error desconocido muestra un mensaje genérico en lugar de romper", async () => {
		renderApp("/email-verified?error=algo_raro");
		expect(
			await screen.findByText(
				"Something went wrong while verifying your email.",
			),
		).toBeInTheDocument();
	});

	it("un parámetro de error con caracteres raros se descarta", async () => {
		renderApp("/email-verified?error=%3Cscript%3E");
		expect(await screen.findByTestId("email-verified")).toBeInTheDocument();
	});
});
