import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import { authService } from "@/services/authService/authService";
import { mockHappyPath, renderApp } from "@/test/render-app";

vi.mock("@/services/authService/authService");
vi.mock("@/services/configService/configService");
vi.mock("@/services/organizationsService/organizationsService");
vi.mock("@/services/projectsService/projectsService");
vi.mock("@/services/issuesService/issuesService");

const signedOut = () =>
	vi.mocked(authService.getSession).mockResolvedValue(null);

beforeEach(() => {
	vi.resetAllMocks();
	mockHappyPath();
});
afterEach(async () => {
	await i18n.changeLanguage("en");
});

describe("landing (/)", () => {
	it("quien no tiene sesión ve la landing, con el producto, las funciones y las llamadas a la acción", async () => {
		signedOut();
		renderApp("/");
		expect(
			await screen.findByRole("heading", {
				level: 1,
				name: /Know what breaks, and what is slow/,
			}),
		).toBeInTheDocument();

		expect(screen.getByTestId("product-preview")).toBeInTheDocument();
		expect(screen.getAllByTestId("feature")).toHaveLength(8);
		for (const title of [
			"Errors grouped into issues",
			"Performance and Web Vitals",
			"Traces across services",
			"Source maps",
			"Alerts where you work",
			"Releases and regressions",
			"Built for teams",
			"Privacy by default",
		])
			expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: "How it works" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: "Built to be understood" }),
		).toBeInTheDocument();
	});

	it("crear cuenta y la documentación llevan a su pantalla", async () => {
		signedOut();
		const { user, router } = renderApp("/");
		await user.click(
			(
				await screen.findAllByRole("link", { name: "Create a free account" })
			)[0],
		);
		await waitFor(() =>
			expect(router.state.location.pathname).toBe("/register"),
		);
	});

	it("la barra superior lleva a iniciar sesión, a crear cuenta y a la documentación", async () => {
		signedOut();
		const { user, router } = renderApp("/");
		const header = (await screen.findByRole("banner")) as HTMLElement;
		expect(
			within(header).getByRole("link", { name: "Sign in" }),
		).toHaveAttribute("href", "/login");
		expect(
			within(header).getByRole("link", { name: "Create account" }),
		).toHaveAttribute("href", "/register");
		await user.click(within(header).getByRole("link", { name: "Docs" }));
		await waitFor(() => expect(router.state.location.pathname).toBe("/docs"));
		expect(
			await screen.findByRole("heading", { level: 1, name: "Documentation" }),
		).toBeInTheDocument();
	});

	it("los SDK se pueden recorrer y cada uno muestra su instalación", async () => {
		signedOut();
		const { user } = renderApp("/");
		const snippet = async () =>
			(await screen.findByTestId("sdk-snippet")).textContent ?? "";
		expect(await snippet()).toContain("npm install @sentinel/browser");

		const tabs = await screen.findByRole("tablist", {
			name: "One SDK for each place your code runs",
		});
		const expected: Record<string, string> = {
			React: "npm install @sentinel/react",
			"Node.js": "npm install @sentinel/node",
			Python: "pip install sentinel-sdk",
			"React Native": "npm install @sentinel/react-native",
		};
		for (const [tab, command] of Object.entries(expected)) {
			await user.click(within(tabs).getByRole("tab", { name: tab }));
			expect(await snippet()).toContain(command);
		}
		expect(await snippet()).toContain("<key>@sentinel.example.com"); // una DSN de ejemplo, nunca una real
	});

	it("el idioma se cambia desde la barra superior", async () => {
		signedOut();
		const { user } = renderApp("/");
		await user.selectOptions(
			(await screen.findAllByRole("combobox", { name: "Language" }))[0],
			"es",
		);
		expect(
			await screen.findByRole("heading", {
				level: 1,
				name: /Entérate de lo que falla/,
			}),
		).toBeInTheDocument();
		expect(
			within(screen.getAllByRole("banner")[0]).getByRole("link", {
				name: "Iniciar sesión",
			}),
		).toBeInTheDocument();
	});

	it("quien ya tiene sesión entra directo a su organización", async () => {
		const { router } = renderApp("/");
		await waitFor(() => expect(router.state.location.pathname).toBe("/acme"));
		expect(screen.queryByText(/Know what breaks/)).not.toBeInTheDocument();
	});
});

describe("documentación (/docs)", () => {
	it("explica cada tema, con un índice que enlaza a sus secciones", async () => {
		signedOut();
		renderApp("/docs");
		const toc = await screen.findByRole("navigation", { name: "On this page" });
		const links = within(toc).getAllByRole("link");
		expect(links.map((l) => l.getAttribute("href"))).toEqual([
			"#quickstart",
			"#sdks",
			"#sourcemaps",
			"#tracing",
			"#alerts",
			"#api",
		]);
		for (const link of links) {
			const id = link.getAttribute("href")?.slice(1) ?? "";
			expect(document.getElementById(id)).not.toBeNull();
		}
		expect(screen.getAllByTestId("docs-sdk")).toHaveLength(5);
	});

	it("incluye la subida de source maps, la propagación de trazas y la API de ingesta", async () => {
		signedOut();
		renderApp("/docs");
		const docs = await screen.findByTestId("docs-content");
		expect(docs).toHaveTextContent(
			"sentinel-cli sourcemaps upload ./dist --release 1.4.2",
		);
		expect(docs).toHaveTextContent("tracePropagationTargets");
		expect(docs).toHaveTextContent("X-Sentinel-Key");
		expect(docs).toHaveTextContent("POST");
		expect(docs).toHaveTextContent("/api/:projectId/transactions");
		expect(
			within(docs).getByRole("link", { name: "API reference" }),
		).toHaveAttribute("href", "/api/docs");
	});

	it("con sesión, la barra ofrece abrir la aplicación en lugar de iniciar sesión", async () => {
		renderApp("/docs");
		const header = (await screen.findAllByRole("banner"))[0];
		await waitFor(() =>
			expect(
				within(header).getByRole("link", { name: "Open the app" }),
			).toBeInTheDocument(),
		);
		expect(
			within(header).queryByRole("link", { name: "Sign in" }),
		).not.toBeInTheDocument();
	});
});
