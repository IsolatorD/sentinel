import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-error";
import { projectsService } from "@/services/projects.service";
import * as fx from "@/test/fixtures";
import { mockHappyPath, renderApp, SETTINGS_PATH } from "@/test/render-app";

vi.mock("@/services/auth.service");
vi.mock("@/services/config.service");
vi.mock("@/services/organizations.service");
vi.mock("@/services/projects.service");
vi.mock("@/services/issues.service");

beforeEach(() => {
	vi.resetAllMocks();
	mockHappyPath();
});

const revokedKey = {
	...fx.key,
	id: "99999999-9999-4999-8999-999999999999",
	label: "Staging",
	isActive: false,
};

describe("configuración del proyecto", () => {
	it("muestra los datos generales, las claves DSN y las instrucciones de instalación", async () => {
		renderApp(SETTINGS_PATH);
		expect(await screen.findByLabelText("Project name")).toHaveValue(
			"Storefront",
		);
		expect(screen.getByLabelText("Platform")).toHaveValue("react");

		const row = screen.getByTestId("key-row");
		expect(within(row).getByText("Default")).toBeInTheDocument();
		expect(within(row).getByText("Active")).toBeInTheDocument();
		expect(within(row).getByText(fx.key.dsn)).toBeInTheDocument();

		const install = screen.getByTestId("install-instructions");
		expect(
			within(install).getByText(/npm install @sentinel\/browser/),
		).toBeInTheDocument();
		expect(install).toHaveTextContent(fx.key.dsn);
	});

	it("las instrucciones también se pueden ver como etiqueta <script>", async () => {
		const { user } = renderApp(SETTINGS_PATH);
		const install = await screen.findByTestId("install-instructions");
		await user.click(within(install).getByRole("tab", { name: "Script tag" }));
		expect(install).toHaveTextContent(
			'<script src="https://your-cdn.example.com/sentinel.min.js"></script>',
		);
		expect(install).toHaveTextContent(fx.key.dsn);
	});

	it("guardar cambios envía el nombre y la plataforma, y confirma", async () => {
		vi.mocked(projectsService.update).mockResolvedValue({
			...fx.project,
			name: "Tienda",
		});
		const { user } = renderApp(SETTINGS_PATH);
		const name = await screen.findByLabelText("Project name");
		await user.clear(name);
		await user.type(name, "Tienda");
		await user.selectOptions(screen.getByLabelText("Platform"), "node");
		await user.click(screen.getByRole("button", { name: "Save changes" }));

		expect(projectsService.update).toHaveBeenCalledWith(
			"org-1",
			fx.PROJECT_ID,
			{ name: "Tienda", platform: "node" },
		);
		expect(await screen.findByText("Changes saved.")).toBeInTheDocument();
	});

	it("no permite guardar un nombre vacío", async () => {
		const { user } = renderApp(SETTINGS_PATH);
		await user.clear(await screen.findByLabelText("Project name"));
		await user.click(screen.getByRole("button", { name: "Save changes" }));
		expect(
			await screen.findByText("This field is required."),
		).toBeInTheDocument();
		expect(projectsService.update).not.toHaveBeenCalled();
	});

	it("un usuario sin permisos recibe un mensaje claro al intentar cambiar algo", async () => {
		vi.mocked(projectsService.update).mockRejectedValue(
			new ApiError(403, "Insufficient permissions"),
		);
		const { user } = renderApp(SETTINGS_PATH);
		await screen.findByLabelText("Project name");
		await user.click(screen.getByRole("button", { name: "Save changes" }));
		expect(
			await screen.findByText(
				"Only owners and admins can change these settings.",
			),
		).toBeInTheDocument();
	});
});

describe("claves DSN", () => {
	it("revocar y volver a activar una clave", async () => {
		vi.mocked(projectsService.get).mockResolvedValue({
			...fx.project,
			keys: [fx.key, revokedKey],
		});
		vi.mocked(projectsService.updateKey).mockResolvedValue(fx.key);
		const { user } = renderApp(SETTINGS_PATH);
		const rows = await screen.findAllByTestId("key-row");
		expect(within(rows[1]).getByText("Revoked")).toBeInTheDocument();

		await user.click(within(rows[0]).getByRole("button", { name: "Revoke" }));
		expect(projectsService.updateKey).toHaveBeenLastCalledWith(
			"org-1",
			fx.PROJECT_ID,
			fx.KEY_ID,
			{ isActive: false },
		);
		await user.click(within(rows[1]).getByRole("button", { name: "Enable" }));
		expect(projectsService.updateKey).toHaveBeenLastCalledWith(
			"org-1",
			fx.PROJECT_ID,
			revokedKey.id,
			{ isActive: true },
		);
	});

	it("crear una clave con etiqueta, o con la de por defecto", async () => {
		vi.mocked(projectsService.createKey).mockResolvedValue(fx.key);
		const { user } = renderApp(SETTINGS_PATH);
		await user.type(await screen.findByLabelText("Label"), "Producción");
		await user.click(screen.getByRole("button", { name: "Create key" }));
		expect(projectsService.createKey).toHaveBeenLastCalledWith(
			"org-1",
			fx.PROJECT_ID,
			{ label: "Producción" },
		);

		await user.click(screen.getByRole("button", { name: "Create key" }));
		expect(projectsService.createKey).toHaveBeenLastCalledWith(
			"org-1",
			fx.PROJECT_ID,
			{ label: "New key" },
		);
	});

	it("eliminar una clave pide confirmación", async () => {
		const { user } = renderApp(SETTINGS_PATH);
		await user.click(await screen.findByRole("button", { name: "Delete" }));
		const dialog = await screen.findByRole("dialog");
		expect(projectsService.removeKey).not.toHaveBeenCalled();
		await user.click(within(dialog).getByRole("button", { name: "Delete" }));
		expect(projectsService.removeKey).toHaveBeenCalledWith(
			"org-1",
			fx.PROJECT_ID,
			fx.KEY_ID,
		);
	});

	it("si falla una acción sobre las claves muestra el error", async () => {
		vi.mocked(projectsService.updateKey).mockRejectedValue(
			new ApiError(403, "Insufficient permissions"),
		);
		const { user } = renderApp(SETTINGS_PATH);
		await user.click(await screen.findByRole("button", { name: "Revoke" }));
		expect(
			await screen.findByText(
				"Only owners and admins can change these settings.",
			),
		).toBeInTheDocument();
	});
});

describe("zona de peligro", () => {
	it("eliminar el proyecto exige escribir su nombre", async () => {
		const { user, router } = renderApp(SETTINGS_PATH);
		await user.click(
			await screen.findByRole("button", { name: "Delete project" }),
		);
		const dialog = await screen.findByRole("dialog");
		const confirm = within(dialog).getByRole("button", {
			name: "Delete project",
		});
		expect(confirm).toBeDisabled();

		await user.type(
			within(dialog).getByLabelText("Project name"),
			"Otro nombre",
		);
		expect(confirm).toBeDisabled();
		await user.clear(within(dialog).getByLabelText("Project name"));
		await user.type(
			within(dialog).getByLabelText("Project name"),
			"Storefront",
		);
		expect(confirm).toBeEnabled();

		await user.click(confirm);
		expect(projectsService.remove).toHaveBeenCalledWith("org-1", fx.PROJECT_ID);
		await waitFor(() =>
			expect(router.state.location.pathname).toBe("/acme/projects"),
		);
	});
});
