import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authService } from "@/services/authService/authService";
import { configService } from "@/services/configService/configService";
import { issuesService } from "@/services/issuesService/issuesService";
import { organizationsService } from "@/services/organizationsService/organizationsService";
import { projectsService } from "@/services/projectsService/projectsService";
import * as fx from "@/test/fixtures";
import { mockHappyPath, renderApp } from "@/test/render-app";
import { ApiError } from "@/utils/apiError/apiError";

vi.mock("@/services/authService/authService");
vi.mock("@/services/configService/configService");
vi.mock("@/services/organizationsService/organizationsService");
vi.mock("@/services/projectsService/projectsService");
vi.mock("@/services/issuesService/issuesService");

beforeEach(() => {
	vi.resetAllMocks();
	mockHappyPath();
});

const signedOut = () =>
	vi.mocked(authService.getSession).mockResolvedValue(null);

describe("acceso", () => {
	it("sin sesión, entrar a cualquier ruta lleva al login", async () => {
		signedOut();
		renderApp("/acme/projects/storefront/issues");
		expect(
			await screen.findByRole("heading", { name: "Sign in to Sentinel" }),
		).toBeInTheDocument();
		expect(issuesService.list).not.toHaveBeenCalled();
	});

	it("con sesión, el login redirige a la app", async () => {
		renderApp("/login");
		expect(
			await screen.findByRole("heading", { name: "Issues" }),
		).toBeInTheDocument();
	});

	it("enviar el login vacío muestra los errores de cada campo y no llama al servidor", async () => {
		signedOut();
		const { user } = renderApp("/login");
		await user.click(await screen.findByRole("button", { name: "Sign in" }));
		expect(await screen.findAllByText("This field is required.")).toHaveLength(
			2,
		);
		expect(authService.signInEmail).not.toHaveBeenCalled();
	});

	it("rechaza un correo con formato inválido", async () => {
		signedOut();
		const { user } = renderApp("/login");
		await user.type(await screen.findByLabelText("Email"), "no-es-un-correo");
		await user.type(screen.getByLabelText("Password"), "algo");
		await user.click(screen.getByRole("button", { name: "Sign in" }));
		expect(
			await screen.findByText("Enter a valid email address."),
		).toBeInTheDocument();
	});

	it("credenciales incorrectas muestran un mensaje claro", async () => {
		signedOut();
		vi.mocked(authService.signInEmail).mockRejectedValue(
			new ApiError(401, "Invalid email or password"),
		);
		const { user } = renderApp("/login");
		await user.type(await screen.findByLabelText("Email"), "ana@example.com");
		await user.type(screen.getByLabelText("Password"), "mala-clave");
		await user.click(screen.getByRole("button", { name: "Sign in" }));
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Incorrect email or password.",
		);
	});

	it("un login correcto lleva directo a los issues del último proyecto", async () => {
		vi.mocked(authService.getSession)
			.mockResolvedValueOnce(null)
			.mockResolvedValue({ user: fx.user });
		vi.mocked(authService.signInEmail).mockResolvedValue(undefined);
		const { user, router } = renderApp("/login");

		await user.type(await screen.findByLabelText("Email"), "ana@example.com");
		await user.type(screen.getByLabelText("Password"), "clave-correcta-1");
		await user.click(screen.getByRole("button", { name: "Sign in" }));

		expect(await screen.findByText(fx.issue().title)).toBeInTheDocument();
		expect(authService.signInEmail).toHaveBeenCalledWith({
			email: "ana@example.com",
			password: "clave-correcta-1",
		});
		expect(router.state.location.pathname).toBe(
			"/acme/projects/storefront/issues",
		);
	});

	it("el botón de Google solo aparece si el backend lo tiene configurado", async () => {
		signedOut();
		const first = renderApp("/login");
		await screen.findByRole("button", { name: "Sign in" });
		expect(
			screen.queryByRole("button", { name: "Continue with Google" }),
		).not.toBeInTheDocument();
		first.unmount();

		vi.mocked(configService.getPublicConfig).mockResolvedValue({
			authProviders: { google: true },
			emailEnabled: true,
		});
		const second = renderApp("/login");
		const google = await screen.findByRole("button", {
			name: "Continue with Google",
		});
		await second.user.click(google);
		expect(authService.signInGoogle).toHaveBeenCalled();
	});
});

describe("registro", () => {
	it("valida nombre, correo y una contraseña de al menos 8 caracteres", async () => {
		signedOut();
		const { user } = renderApp("/register");
		await user.type(await screen.findByLabelText("Password"), "corta");
		await user.click(screen.getByRole("button", { name: "Create account" }));
		expect(
			await screen.findByText("Use at least 8 characters."),
		).toBeInTheDocument();
		expect(screen.getAllByText("This field is required.")).toHaveLength(2);
		expect(authService.signUpEmail).not.toHaveBeenCalled();
	});

	it("un correo ya registrado muestra un mensaje específico", async () => {
		signedOut();
		vi.mocked(authService.signUpEmail).mockRejectedValue(
			new ApiError(422, "User already exists", "USER_ALREADY_EXISTS"),
		);
		const { user } = renderApp("/register");
		await user.type(await screen.findByLabelText("Full name"), "Ana Pérez");
		await user.type(screen.getByLabelText("Email"), "ana@example.com");
		await user.type(screen.getByLabelText("Password"), "una-clave-larga");
		await user.click(screen.getByRole("button", { name: "Create account" }));
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"An account with this email already exists.",
		);
	});

	it("tras registrarse, un usuario sin organizaciones llega al onboarding (no vuelve al login)", async () => {
		vi.mocked(authService.getSession)
			.mockResolvedValueOnce(null)
			.mockResolvedValue({ user: fx.user });
		vi.mocked(authService.signUpEmail).mockResolvedValue(undefined);
		vi.mocked(organizationsService.list).mockResolvedValue([]);
		const { user, router } = renderApp("/register");

		await user.type(await screen.findByLabelText("Full name"), "Ana Pérez");
		await user.type(screen.getByLabelText("Email"), "ana@example.com");
		await user.type(screen.getByLabelText("Password"), "una-clave-larga");
		await user.click(screen.getByRole("button", { name: "Create account" }));

		expect(
			await screen.findByRole("heading", { name: "Welcome to Sentinel" }),
		).toBeInTheDocument();
		expect(router.state.location.pathname).toBe("/onboarding");
	});
});

describe("navegación inicial", () => {
	it("sin organizaciones lleva al onboarding", async () => {
		vi.mocked(organizationsService.list).mockResolvedValue([]);
		renderApp("/");
		expect(
			await screen.findByRole("heading", { name: "Create your organization" }),
		).toBeInTheDocument();
	});

	it("una organización de la URL que no existe muestra 'no encontrada'", async () => {
		renderApp("/otra-org/projects");
		expect(
			await screen.findByRole("heading", { name: "Page not found" }),
		).toBeInTheDocument();
	});

	it("un proyecto que no existe en la organización muestra 'no encontrada'", async () => {
		renderApp("/acme/projects/no-existe/issues");
		expect(
			await screen.findByRole("heading", { name: "Page not found" }),
		).toBeInTheDocument();
	});

	it("una organización sin proyectos lleva al listado de proyectos", async () => {
		vi.mocked(projectsService.list).mockResolvedValue([]);
		const { router } = renderApp("/acme");
		expect(await screen.findByText("No projects yet")).toBeInTheDocument();
		await waitFor(() =>
			expect(router.state.location.pathname).toBe("/acme/projects"),
		);
	});

	it("recuerda la última organización usada", async () => {
		vi.mocked(organizationsService.list).mockResolvedValue([
			fx.org,
			{ id: "org-2", name: "Beta", slug: "beta", logo: null },
		]);
		window.localStorage.setItem("sentinel:last-org", "beta");
		const { router } = renderApp("/");
		await waitFor(() =>
			expect(router.state.location.pathname.startsWith("/beta")).toBe(true),
		);
	});
});
