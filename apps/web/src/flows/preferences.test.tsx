import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import { preferencesService } from "@/services/preferencesService/preferencesService";
import * as fx from "@/test/fixtures";
import { ISSUES_PATH, mockHappyPath, renderApp } from "@/test/render-app";
import { tourSeenKey } from "@/utils/storage/storage.constants";

vi.mock("@/services/authService/authService");
vi.mock("@/services/configService/configService");
vi.mock("@/services/organizationsService/organizationsService");
vi.mock("@/services/projectsService/projectsService");
vi.mock("@/services/issuesService/issuesService");

const saved = (over = {}) => ({
	locale: "en" as const,
	theme: "system" as const,
	toursSeen: [] as Array<"welcome" | "issues" | "issueDetail">,
	emailOnAssign: true,
	...over,
});
const flag = (tour: string) =>
	window.localStorage.getItem(tourSeenKey(fx.user.id, tour));

beforeEach(async () => {
	vi.resetAllMocks();
	mockHappyPath();
	document.documentElement.removeAttribute("data-theme");
	await i18n.changeLanguage("en");
});

describe("sincronización de preferencias", () => {
	it("el idioma guardado manda sobre el del navegador", async () => {
		vi.mocked(preferencesService.get).mockResolvedValue(
			saved({ locale: "es" }),
		);
		renderApp(ISSUES_PATH);
		expect(
			await screen.findByRole("tab", { name: "Sin resolver" }),
		).toBeInTheDocument();
		expect(i18n.language).toBe("es");
		// Ya coincide: no hay nada que subir.
		expect(preferencesService.update).not.toHaveBeenCalled();
	});

	it("si el servidor no tiene idioma, sube el actual (y el tema) para la próxima vez", async () => {
		vi.mocked(preferencesService.get).mockResolvedValue({
			locale: null,
			theme: null,
			toursSeen: [],
			emailOnAssign: true,
		});
		renderApp(ISSUES_PATH);
		await screen.findByTestId("issue-list");
		await waitFor(() =>
			expect(preferencesService.update).toHaveBeenCalledTimes(1),
		);
		expect(preferencesService.update).toHaveBeenCalledWith({
			locale: "en",
			theme: "system",
		});
	});

	it("el tema guardado se aplica", async () => {
		vi.mocked(preferencesService.get).mockResolvedValue(
			saved({ theme: "dark" }),
		);
		renderApp(ISSUES_PATH);
		await waitFor(() =>
			expect(document.documentElement.dataset.theme).toBe("dark"),
		);
		expect(window.localStorage.getItem("sentinel:theme")).toBe("dark");
	});

	it("los recorridos vistos se unen: lo del servidor baja y lo de este navegador sube", async () => {
		window.localStorage.setItem(tourSeenKey(fx.user.id, "issues"), "1");
		vi.mocked(preferencesService.get).mockResolvedValue(
			saved({ toursSeen: ["welcome"] }),
		);
		renderApp(ISSUES_PATH);
		await waitFor(() => expect(flag("welcome")).toBe("1"));
		await waitFor(() =>
			expect(preferencesService.update).toHaveBeenCalledWith({
				toursSeen: ["welcome", "issues"],
			}),
		);
		expect(flag("issues")).toBe("1");
	});

	it("solo se sincroniza una vez por sesión", async () => {
		vi.mocked(preferencesService.get).mockResolvedValue({
			locale: null,
			theme: null,
			toursSeen: [],
			emailOnAssign: true,
		});
		const { user } = renderApp(ISSUES_PATH);
		await screen.findByTestId("issue-list");
		await waitFor(() =>
			expect(preferencesService.update).toHaveBeenCalledTimes(1),
		);
		// Navegar dentro de la app no repite la subida.
		await user.click(await screen.findByRole("link", { name: "Releases" }));
		await new Promise((r) => setTimeout(r, 300));
		expect(preferencesService.update).toHaveBeenCalledTimes(1);
	});
});

describe("guardar lo que la persona cambia", () => {
	async function openMenu(user: ReturnType<typeof renderApp>["user"]) {
		await user.click(await screen.findByRole("button", { name: "Account" }));
		return screen.findByRole("menu");
	}

	it("cambiar el idioma desde el menú lo guarda", async () => {
		const { user } = renderApp(ISSUES_PATH);
		const menu = await openMenu(user);
		await user.selectOptions(within(menu).getByLabelText("Language"), "es");
		await waitFor(() =>
			expect(preferencesService.update).toHaveBeenCalledWith({ locale: "es" }),
		);
		await waitFor(() => expect(i18n.language).toBe("es"));
	});

	it("cambiar el tema desde el menú lo guarda", async () => {
		const { user } = renderApp(ISSUES_PATH);
		const menu = await openMenu(user);
		await user.selectOptions(within(menu).getByLabelText("Theme"), "dark");
		await waitFor(() =>
			expect(preferencesService.update).toHaveBeenCalledWith({ theme: "dark" }),
		);
		expect(document.documentElement.dataset.theme).toBe("dark");
	});
});
