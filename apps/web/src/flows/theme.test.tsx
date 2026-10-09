import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ISSUES_PATH, mockHappyPath, renderApp } from "@/test/render-app";

vi.mock("@/services/authService/authService");
vi.mock("@/services/configService/configService");
vi.mock("@/services/organizationsService/organizationsService");
vi.mock("@/services/projectsService/projectsService");
vi.mock("@/services/issuesService/issuesService");

beforeEach(() => {
	vi.resetAllMocks();
	mockHappyPath();
	document.documentElement.removeAttribute("data-theme");
});

async function openAccountMenu(user: ReturnType<typeof renderApp>["user"]) {
	await user.click(await screen.findByRole("button", { name: "Account" }));
	return screen.findByRole("menu");
}

describe("tema", () => {
	it("el menú de la cuenta ofrece sistema, claro y oscuro, y empieza en sistema", async () => {
		const { user } = renderApp(ISSUES_PATH);
		const menu = await openAccountMenu(user);
		const select = within(menu).getByLabelText("Theme");
		expect(select).toHaveValue("system");
		expect(
			within(select)
				.getAllByRole("option")
				.map((o) => o.textContent),
		).toEqual(["System", "Light", "Dark"]);
	});

	it("elegir oscuro lo aplica al documento al instante y lo recuerda", async () => {
		const { user } = renderApp(ISSUES_PATH);
		const menu = await openAccountMenu(user);
		await user.selectOptions(within(menu).getByLabelText("Theme"), "dark");

		expect(document.documentElement.dataset.theme).toBe("dark");
		expect(document.documentElement.style.colorScheme).toBe("dark");
		expect(window.localStorage.getItem("sentinel:theme")).toBe("dark");
		await waitFor(() =>
			expect(within(menu).getByLabelText("Theme")).toHaveValue("dark"),
		);

		await user.selectOptions(within(menu).getByLabelText("Theme"), "light");
		expect(document.documentElement.dataset.theme).toBe("light");
	});

	it("lo guardado se muestra al abrir el menú", async () => {
		window.localStorage.setItem("sentinel:theme", "dark");
		const { user } = renderApp(ISSUES_PATH);
		const menu = await openAccountMenu(user);
		expect(within(menu).getByLabelText("Theme")).toHaveValue("dark");
	});
});
