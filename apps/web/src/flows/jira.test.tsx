import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { integrationsService } from "@/services/integrationsService/integrationsService";
import { issuesService } from "@/services/issuesService/issuesService";
import * as fx from "@/test/fixtures";
import {
	ISSUE_PATH,
	mockHappyPath,
	renderApp,
	settingsSection,
} from "@/test/render-app";
import { ApiError } from "@/utils/apiError/apiError";

vi.mock("@/services/authService/authService");
vi.mock("@/services/configService/configService");
vi.mock("@/services/organizationsService/organizationsService");
vi.mock("@/services/projectsService/projectsService");
vi.mock("@/services/issuesService/issuesService");

const connected = fx.jiraConnection({
	connected: true,
	siteUrl: "https://acme.atlassian.net",
	email: "ana@acme.test",
	projectKey: "APP",
	issueType: "Bug",
});

beforeEach(() => {
	vi.resetAllMocks();
	mockHappyPath();
});

describe("conexión con Jira (configuración)", () => {
	it("sin conexión pide los datos y valida lo obligatorio, incluido el token la primera vez", async () => {
		const { user } = renderApp(settingsSection("integrations"));
		const form = await screen.findByTestId("jira-form");
		await user.click(within(form).getByRole("button", { name: "Connect" }));
		expect(
			within(form).getAllByText("This field is required.").length,
		).toBeGreaterThanOrEqual(4);
		expect(integrationsService.connectJira).not.toHaveBeenCalled();
	});

	it("conecta con lo escrito y muestra que quedó conectado", async () => {
		vi.mocked(integrationsService.connectJira).mockResolvedValue(connected);
		const { user } = renderApp(settingsSection("integrations"));
		const form = await screen.findByTestId("jira-form");
		await user.type(
			within(form).getByLabelText("Jira site"),
			"https://acme.atlassian.net",
		);
		await user.type(
			within(form).getByLabelText("Account email"),
			"ana@acme.test",
		);
		await user.type(within(form).getByLabelText("API token"), "secret-token");
		await user.type(within(form).getByLabelText("Project key"), "APP");
		await user.click(within(form).getByRole("button", { name: "Connect" }));

		await waitFor(() =>
			expect(integrationsService.connectJira).toHaveBeenCalledWith(
				"org-1",
				fx.PROJECT_ID,
				{
					siteUrl: "https://acme.atlassian.net",
					email: "ana@acme.test",
					apiToken: "secret-token",
					projectKey: "APP",
				},
			),
		);
		expect(
			await screen.findByText("Jira connection saved."),
		).toBeInTheDocument();
		expect(screen.getByText("Connected")).toBeInTheDocument();
	});

	it("conectado, el token no se muestra y dejarlo vacío al editar lo conserva", async () => {
		vi.mocked(integrationsService.getJira).mockResolvedValue(connected);
		vi.mocked(integrationsService.connectJira).mockResolvedValue({
			...connected,
			projectKey: "OPS",
		});
		const { user } = renderApp(settingsSection("integrations"));
		const form = await screen.findByTestId("jira-form");
		expect(within(form).getByLabelText("API token")).toHaveValue("");
		expect(within(form).getByLabelText("Jira site")).toHaveValue(
			"https://acme.atlassian.net",
		);
		const key = within(form).getByLabelText("Project key");
		await user.clear(key);
		await user.type(key, "OPS");
		await user.click(
			within(form).getByRole("button", { name: "Save changes" }),
		);
		await waitFor(() =>
			expect(integrationsService.connectJira).toHaveBeenCalledWith(
				"org-1",
				fx.PROJECT_ID,
				expect.not.objectContaining({ apiToken: expect.anything() }),
			),
		);
	});

	it("muestra el motivo si Jira rechaza las credenciales", async () => {
		vi.mocked(integrationsService.connectJira).mockRejectedValue(
			new ApiError(
				400,
				"Jira rejected the credentials. Check the email and the API token",
				undefined,
				undefined,
				undefined,
				"JIRA_AUTH_FAILED",
			),
		);
		const { user } = renderApp(settingsSection("integrations"));
		const form = await screen.findByTestId("jira-form");
		await user.type(
			within(form).getByLabelText("Jira site"),
			"https://acme.atlassian.net",
		);
		await user.type(
			within(form).getByLabelText("Account email"),
			"ana@acme.test",
		);
		await user.type(within(form).getByLabelText("API token"), "bad");
		await user.type(within(form).getByLabelText("Project key"), "APP");
		await user.click(within(form).getByRole("button", { name: "Connect" }));
		expect(
			await within(form).findByText(/Jira rejected the credentials/),
		).toBeInTheDocument();
	});

	it("se puede desconectar", async () => {
		vi.mocked(integrationsService.getJira).mockResolvedValue(connected);
		vi.mocked(integrationsService.disconnectJira).mockResolvedValue(undefined);
		const { user } = renderApp(settingsSection("integrations"));
		const form = await screen.findByTestId("jira-form");
		await user.click(within(form).getByRole("button", { name: "Disconnect" }));
		await waitFor(() =>
			expect(integrationsService.disconnectJira).toHaveBeenCalledWith(
				"org-1",
				fx.PROJECT_ID,
			),
		);
	});
});

describe("ticket de Jira en un issue", () => {
	it("sin conexión con Jira no ofrece crear tickets", async () => {
		renderApp(ISSUE_PATH);
		await screen.findByTestId("issue-header");
		expect(
			screen.queryByRole("button", { name: "Create Jira ticket" }),
		).not.toBeInTheDocument();
	});

	it("conectado, crea el ticket y pasa a mostrar su enlace", async () => {
		vi.mocked(integrationsService.getJira).mockResolvedValue(connected);
		vi.mocked(integrationsService.createTicket).mockImplementation(async () => {
			// El detalle del issue, recargado, ya trae el ticket.
			vi.mocked(issuesService.get).mockResolvedValue(
				fx.issueDetail({ ticket: fx.ticket() }),
			);
			return fx.ticket();
		});
		const { user } = renderApp(ISSUE_PATH);
		await user.click(
			await screen.findByRole("button", { name: "Create Jira ticket" }),
		);
		await waitFor(() =>
			expect(integrationsService.createTicket).toHaveBeenCalledWith(
				"org-1",
				fx.PROJECT_ID,
				fx.ISSUE_ID,
			),
		);
		const link = await screen.findByRole("link", { name: /APP-12/ });
		expect(link).toHaveAttribute(
			"href",
			"https://acme.atlassian.net/browse/APP-12",
		);
		expect(link).toHaveAttribute("target", "_blank");
		expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
		expect(
			screen.queryByRole("button", { name: "Create Jira ticket" }),
		).not.toBeInTheDocument();
	});

	it("explica por qué falló la creación y deja volver a intentarlo", async () => {
		vi.mocked(integrationsService.getJira).mockResolvedValue(connected);
		vi.mocked(integrationsService.createTicket).mockRejectedValue(
			new ApiError(
				502,
				"Jira could not be reached or rejected the request",
				undefined,
				undefined,
				undefined,
				"JIRA_REQUEST_FAILED",
			),
		);
		const { user } = renderApp(ISSUE_PATH);
		await user.click(
			await screen.findByRole("button", { name: "Create Jira ticket" }),
		);
		expect(
			await screen.findByText(/Jira could not be reached/),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Create Jira ticket" }),
		).toBeEnabled();
	});

	it("un issue con ticket lo muestra aunque la conexión ya no exista, y se puede desvincular", async () => {
		vi.mocked(issuesService.get).mockResolvedValue(
			fx.issueDetail({ ticket: fx.ticket() }),
		);
		vi.mocked(integrationsService.unlinkTicket).mockImplementation(async () => {
			vi.mocked(issuesService.get).mockResolvedValue(fx.issueDetail());
		});
		const { user } = renderApp(ISSUE_PATH);
		expect(
			await screen.findByRole("link", { name: /APP-12/ }),
		).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Unlink ticket" }));
		await waitFor(() =>
			expect(integrationsService.unlinkTicket).toHaveBeenCalledWith(
				"org-1",
				fx.PROJECT_ID,
				fx.ISSUE_ID,
			),
		);
		await waitFor(() =>
			expect(
				screen.queryByRole("link", { name: /APP-12/ }),
			).not.toBeInTheDocument(),
		);
	});
});
