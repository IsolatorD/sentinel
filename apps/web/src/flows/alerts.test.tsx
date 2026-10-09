import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { alertsService } from "@/services/alertsService/alertsService";
import { configService } from "@/services/configService/configService";
import { organizationsService } from "@/services/organizationsService/organizationsService";
import * as fx from "@/test/fixtures";
import { mockHappyPath, renderApp } from "@/test/render-app";
import { ApiError } from "@/utils/apiError/apiError";

vi.mock("@/services/authService/authService");
vi.mock("@/services/configService/configService");
vi.mock("@/services/organizationsService/organizationsService");
vi.mock("@/services/projectsService/projectsService");
vi.mock("@/services/issuesService/issuesService");
vi.mock("@/services/alertsService/alertsService");

const PATH = "/acme/projects/storefront/alerts";
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

const channel = (over = {}) => ({
	id: "c1111111-1111-4111-8111-111111111111",
	projectId: fx.PROJECT_ID,
	type: "email" as const,
	name: "Equipo",
	enabled: true,
	maskedUrl: null,
	recipients: { mode: "all" as const },
	createdAt: ago(3600_000),
	...over,
});

const rule = (over = {}) => ({
	id: "r1111111-1111-4111-8111-111111111111",
	projectId: fx.PROJECT_ID,
	name: "Errores nuevos",
	trigger: "new_issue" as const,
	threshold: null,
	windowMinutes: null,
	cooldownMinutes: 60,
	environment: null,
	minLevel: null,
	channelIds: [channel().id],
	enabled: true,
	createdAt: ago(3600_000),
	updatedAt: ago(3600_000),
	...over,
});

const delivery = (over = {}) => ({
	id: "d1111111-1111-4111-8111-111111111111",
	kind: "alert" as const,
	status: "sent" as const,
	ruleId: rule().id,
	ruleName: "Errores nuevos",
	channelId: channel().id,
	channelName: "Equipo",
	channelType: "email" as const,
	issueId: fx.ISSUE_ID,
	issueTitle: "TypeError: x is undefined",
	attempts: 1,
	error: null,
	statusCode: null,
	createdAt: ago(60_000),
	sentAt: ago(59_000),
	...over,
});

beforeEach(() => {
	vi.resetAllMocks();
	mockHappyPath();
	vi.mocked(configService.getPublicConfig).mockResolvedValue({
		authProviders: { google: false },
		emailEnabled: true,
		emailVerification: false,
	});
	vi.mocked(organizationsService.listMembers).mockResolvedValue([
		{
			id: "m1",
			userId: "u1",
			role: "owner",
			createdAt: new Date(),
			user: { name: "Ana Pérez", email: "ana@example.com" },
		},
		{
			id: "m2",
			userId: "u2",
			role: "member",
			createdAt: new Date(),
			user: { name: "Luis Gómez", email: "luis@example.com" },
		},
	]);
	vi.mocked(alertsService.listChannels).mockResolvedValue([channel()]);
	vi.mocked(alertsService.listRules).mockResolvedValue([rule()]);
	vi.mocked(alertsService.listDeliveries).mockResolvedValue({
		items: [delivery()],
		total: 1,
		limit: 25,
		offset: 0,
	});
});

describe("navegación", () => {
	it("el menú lleva a Alertas, que abre en Reglas, y las pestañas se reflejan en la URL", async () => {
		const { user, router } = renderApp("/acme/projects/storefront/issues");
		await user.click(await screen.findByRole("link", { name: "Alerts" }));
		await waitFor(() => expect(router.state.location.pathname).toBe(PATH));
		expect(await screen.findByTestId("rule-row")).toBeInTheDocument();

		await user.click(screen.getByRole("tab", { name: "Channels" }));
		expect(await screen.findByTestId("channel-row")).toBeInTheDocument();
		expect(router.state.location.search).toMatchObject({ tab: "channels" });

		await user.click(screen.getByRole("tab", { name: "History" }));
		expect(await screen.findByTestId("delivery-row")).toBeInTheDocument();
	});
});

describe("reglas", () => {
	it("lista la regla con su resumen y los canales a los que avisa", async () => {
		renderApp(PATH);
		const row = await screen.findByTestId("rule-row");
		expect(within(row).getByText("Errores nuevos")).toBeInTheDocument();
		expect(
			within(row).getByText("When a new issue appears"),
		).toBeInTheDocument();
		expect(within(row).getByText(/Equipo/)).toBeInTheDocument();
	});

	it("una regla de frecuencia se describe con su umbral y su ventana", async () => {
		vi.mocked(alertsService.listRules).mockResolvedValue([
			rule({
				trigger: "frequency",
				threshold: 50,
				windowMinutes: 60,
				environment: "production",
				minLevel: "error",
			}),
		]);
		renderApp(PATH);
		const row = await screen.findByTestId("rule-row");
		expect(within(row).getByText(/50 events in 1 hour/)).toBeInTheDocument();
		expect(within(row).getByText(/production/)).toBeInTheDocument();
		expect(within(row).getByText(/Error or worse/)).toBeInTheDocument();
	});

	it("sin canales no se puede crear una regla y se explica por qué", async () => {
		vi.mocked(alertsService.listChannels).mockResolvedValue([]);
		renderApp(PATH);
		expect(
			await screen.findByText(/Create a channel first/),
		).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Create rule" })).toBeDisabled();
	});

	it("crear una regla valida los campos y envía lo que se eligió", async () => {
		vi.mocked(alertsService.createRule).mockResolvedValue(rule());
		const { user } = renderApp(PATH);
		await user.click(
			await screen.findByRole("button", { name: "Create rule" }),
		);
		const dialog = await screen.findByRole("dialog");

		// Sin nombre ni canal: dos errores y no se envía nada.
		await user.click(within(dialog).getByRole("button", { name: "Create" }));
		expect(within(dialog).getAllByRole("alert").length).toBeGreaterThanOrEqual(
			2,
		);
		expect(alertsService.createRule).not.toHaveBeenCalled();

		await user.type(within(dialog).getByLabelText("Name"), "Picos de errores");
		await user.selectOptions(
			within(dialog).getByLabelText("Alert me when"),
			"frequency",
		);
		const threshold = within(dialog).getByLabelText("Events");
		await user.clear(threshold);
		await user.type(threshold, "25");
		await user.selectOptions(within(dialog).getByLabelText("Within"), "30");
		await user.type(within(dialog).getByLabelText("Environment"), "production");
		await user.selectOptions(
			within(dialog).getByLabelText("Minimum level"),
			"error",
		);
		await user.click(within(dialog).getByRole("checkbox", { name: /Equipo/ }));
		// El error de canal desaparece al elegir uno.
		expect(
			within(dialog).queryByText("Choose at least one channel."),
		).not.toBeInTheDocument();
		await user.click(within(dialog).getByRole("button", { name: "Create" }));

		await waitFor(() =>
			expect(alertsService.createRule).toHaveBeenCalledWith(
				"org-1",
				fx.PROJECT_ID,
				{
					name: "Picos de errores",
					trigger: "frequency",
					threshold: 25,
					windowMinutes: 30,
					cooldownMinutes: 60,
					environment: "production",
					minLevel: "error",
					channelIds: [channel().id],
					enabled: true,
				},
			),
		);
		await waitFor(() =>
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
		);
	});

	it("rechaza un umbral que no es un entero válido", async () => {
		const { user } = renderApp(PATH);
		await user.click(
			await screen.findByRole("button", { name: "Create rule" }),
		);
		const dialog = await screen.findByRole("dialog");
		await user.type(within(dialog).getByLabelText("Name"), "x");
		await user.selectOptions(
			within(dialog).getByLabelText("Alert me when"),
			"frequency",
		);
		const threshold = within(dialog).getByLabelText("Events");
		await user.clear(threshold);
		await user.type(threshold, "0");
		await user.click(within(dialog).getByRole("checkbox", { name: /Equipo/ }));
		await user.click(within(dialog).getByRole("button", { name: "Create" }));
		expect(
			await within(dialog).findByText(/whole number between 1 and 100000/),
		).toBeInTheDocument();
		expect(alertsService.createRule).not.toHaveBeenCalled();
	});

	it("editar una regla parte de sus valores y envía el conjunto completo", async () => {
		vi.mocked(alertsService.updateRule).mockResolvedValue(rule());
		const { user } = renderApp(PATH);
		await user.click(
			await screen.findByRole("button", { name: "Edit rule Errores nuevos" }),
		);
		const dialog = await screen.findByRole("dialog");
		const name = within(dialog).getByLabelText("Name");
		expect(name).toHaveValue("Errores nuevos");
		await user.clear(name);
		await user.type(name, "Renombrada");
		await user.click(
			within(dialog).getByRole("button", { name: "Save changes" }),
		);
		await waitFor(() =>
			expect(alertsService.updateRule).toHaveBeenCalledWith(
				"org-1",
				fx.PROJECT_ID,
				rule().id,
				{
					name: "Renombrada",
					trigger: "new_issue",
					threshold: null,
					windowMinutes: null,
					cooldownMinutes: 60,
					environment: null,
					minLevel: null,
					channelIds: [channel().id],
					enabled: true,
				},
			),
		);
	});

	it("la casilla activa o desactiva la regla sin abrir nada", async () => {
		vi.mocked(alertsService.updateRule).mockResolvedValue(
			rule({ enabled: false }),
		);
		const { user } = renderApp(PATH);
		await user.click(
			await screen.findByRole("checkbox", {
				name: /Enable or disable Errores nuevos/,
			}),
		);
		expect(alertsService.updateRule).toHaveBeenCalledWith(
			"org-1",
			fx.PROJECT_ID,
			rule().id,
			{ enabled: false },
		);
	});

	it("eliminar pide confirmación", async () => {
		vi.mocked(alertsService.deleteRule).mockResolvedValue(undefined);
		const { user } = renderApp(PATH);
		await user.click(
			await screen.findByRole("button", { name: "Delete rule Errores nuevos" }),
		);
		const dialog = await screen.findByRole("dialog");
		expect(alertsService.deleteRule).not.toHaveBeenCalled();
		await user.click(
			within(dialog).getByRole("button", { name: "Delete rule" }),
		);
		expect(alertsService.deleteRule).toHaveBeenCalledWith(
			"org-1",
			fx.PROJECT_ID,
			rule().id,
		);
	});

	it("un member ve un mensaje de permisos en lugar de un error genérico", async () => {
		vi.mocked(alertsService.listRules).mockRejectedValue(
			new ApiError(403, "Insufficient permissions"),
		);
		renderApp(PATH);
		expect(
			await screen.findByText("Only owners and admins can manage alerts."),
		).toBeInTheDocument();
	});
});

describe("canales", () => {
	const CHANNELS = `${PATH}?tab=channels`;

	it("lista los canales con su destino; un webhook solo muestra la URL enmascarada", async () => {
		vi.mocked(alertsService.listChannels).mockResolvedValue([
			channel(),
			channel({
				id: "c2",
				type: "webhook",
				name: "Ops",
				maskedUrl: "https://ops.example.com/…ab12",
				recipients: null,
			}),
		]);
		renderApp(CHANNELS);
		const rows = await screen.findAllByTestId("channel-row");
		expect(
			within(rows[0]).getByText("All members of the organization"),
		).toBeInTheDocument();
		expect(
			within(rows[1]).getByText("https://ops.example.com/…ab12"),
		).toBeInTheDocument();
	});

	it("avisa si el servidor no tiene correo configurado", async () => {
		vi.mocked(configService.getPublicConfig).mockResolvedValue({
			authProviders: { google: false },
			emailEnabled: false,
			emailVerification: false,
		});
		renderApp(CHANNELS);
		expect(await screen.findByText(/no email configured/)).toBeInTheDocument();
	});

	it("crear un canal de email para todos los miembros", async () => {
		vi.mocked(alertsService.createChannel).mockResolvedValue({
			...channel(),
			signingSecret: null,
		});
		const { user } = renderApp(CHANNELS);
		await user.click(
			await screen.findByRole("button", { name: "Create channel" }),
		);
		const dialog = await screen.findByRole("dialog");
		await user.type(within(dialog).getByLabelText("Name"), "Guardia");
		await user.click(within(dialog).getByRole("button", { name: "Create" }));
		await waitFor(() =>
			expect(alertsService.createChannel).toHaveBeenCalledWith(
				"org-1",
				fx.PROJECT_ID,
				{
					type: "email",
					name: "Guardia",
					recipients: { mode: "all" },
				},
			),
		);
	});

	it("con destinatarios concretos hay que elegir al menos un miembro", async () => {
		vi.mocked(alertsService.createChannel).mockResolvedValue({
			...channel(),
			signingSecret: null,
		});
		const { user } = renderApp(CHANNELS);
		await user.click(
			await screen.findByRole("button", { name: "Create channel" }),
		);
		const dialog = await screen.findByRole("dialog");
		await user.type(within(dialog).getByLabelText("Name"), "Pocos");
		await user.click(
			within(dialog).getByRole("radio", { name: "Only some members" }),
		);
		await user.click(within(dialog).getByRole("button", { name: "Create" }));
		expect(
			await within(dialog).findByText("Choose at least one member."),
		).toBeInTheDocument();

		await user.click(
			await within(dialog).findByRole("checkbox", { name: /Luis Gómez/ }),
		);
		await user.click(within(dialog).getByRole("button", { name: "Create" }));
		await waitFor(() =>
			expect(alertsService.createChannel).toHaveBeenCalledWith(
				"org-1",
				fx.PROJECT_ID,
				{
					type: "email",
					name: "Pocos",
					recipients: { mode: "members", userIds: ["u2"] },
				},
			),
		);
	});

	it("un webhook valida la URL y, al crearse, muestra su secreto de firma una sola vez", async () => {
		vi.mocked(alertsService.createChannel).mockResolvedValue({
			...channel({
				type: "webhook",
				name: "Ops",
				maskedUrl: "https://ops.example.com/…ab12",
				recipients: null,
			}),
			signingSecret: `whsec_${"a".repeat(48)}`,
		});
		const { user } = renderApp(CHANNELS);
		await user.click(
			await screen.findByRole("button", { name: "Create channel" }),
		);
		const dialog = await screen.findByRole("dialog");
		await user.selectOptions(within(dialog).getByLabelText("Type"), "webhook");
		await user.type(within(dialog).getByLabelText("Name"), "Ops");
		await user.type(within(dialog).getByLabelText("URL"), "ftp://nope");
		await user.click(within(dialog).getByRole("button", { name: "Create" }));
		expect(
			await within(dialog).findByText(/valid http:\/\/ or https:\/\/ URL/),
		).toBeInTheDocument();
		expect(alertsService.createChannel).not.toHaveBeenCalled();

		await user.clear(within(dialog).getByLabelText("URL"));
		await user.type(
			within(dialog).getByLabelText("URL"),
			"https://ops.example.com/hook",
		);
		await user.click(within(dialog).getByRole("button", { name: "Create" }));

		const secret = await screen.findByTestId("signing-secret");
		expect(secret).toHaveTextContent(`whsec_${"a".repeat(48)}`);
		await user.click(screen.getByRole("button", { name: "Done" }));
		await waitFor(() =>
			expect(screen.queryByTestId("signing-secret")).not.toBeInTheDocument(),
		);
		expect(alertsService.createChannel).toHaveBeenCalledWith(
			"org-1",
			fx.PROJECT_ID,
			{
				type: "webhook",
				name: "Ops",
				url: "https://ops.example.com/hook",
			},
		);
	});

	it("el servidor puede rechazar una URL (host interno) y se muestra su motivo", async () => {
		vi.mocked(alertsService.createChannel).mockRejectedValue(
			new ApiError(
				400,
				"The URL points to a private or internal address",
				"BAD_REQUEST",
				undefined,
				undefined,
				"URL_NOT_ALLOWED",
			),
		);
		const { user } = renderApp(CHANNELS);
		await user.click(
			await screen.findByRole("button", { name: "Create channel" }),
		);
		const dialog = await screen.findByRole("dialog");
		await user.selectOptions(within(dialog).getByLabelText("Type"), "slack");
		await user.type(within(dialog).getByLabelText("Name"), "Slack");
		await user.type(
			within(dialog).getByLabelText("URL"),
			"http://192.168.1.5/hook",
		);
		await user.click(within(dialog).getByRole("button", { name: "Create" }));
		expect(
			await within(dialog).findByText(
				"The URL points to a private or internal address",
			),
		).toBeInTheDocument();
	});

	it("enviar prueba pide el aviso y explica dónde ver el resultado", async () => {
		vi.mocked(alertsService.testChannel).mockResolvedValue(
			delivery({ kind: "test", status: "pending" }),
		);
		const { user } = renderApp(CHANNELS);
		await user.click(await screen.findByRole("button", { name: "Send test" }));
		expect(alertsService.testChannel).toHaveBeenCalledWith(
			"org-1",
			fx.PROJECT_ID,
			channel().id,
		);
		expect(await screen.findByText(/Test sent/)).toBeInTheDocument();
	});

	it("desactivar y eliminar un canal", async () => {
		vi.mocked(alertsService.updateChannel).mockResolvedValue(
			channel({ enabled: false }),
		);
		vi.mocked(alertsService.deleteChannel).mockResolvedValue(undefined);
		const { user } = renderApp(CHANNELS);
		await user.click(
			await screen.findByRole("checkbox", { name: /Enable or disable Equipo/ }),
		);
		expect(alertsService.updateChannel).toHaveBeenCalledWith(
			"org-1",
			fx.PROJECT_ID,
			channel().id,
			{ enabled: false },
		);

		await user.click(
			screen.getByRole("button", { name: "Delete channel Equipo" }),
		);
		const dialog = await screen.findByRole("dialog");
		await user.click(
			within(dialog).getByRole("button", { name: "Delete channel" }),
		);
		expect(alertsService.deleteChannel).toHaveBeenCalledWith(
			"org-1",
			fx.PROJECT_ID,
			channel().id,
		);
	});
});

describe("historial", () => {
	const HISTORY = `${PATH}?tab=history`;

	it("muestra cada aviso con su estado, canal e issue, y enlaza al issue", async () => {
		vi.mocked(alertsService.listDeliveries).mockResolvedValue({
			items: [
				delivery(),
				delivery({
					id: "d2",
					status: "failed",
					attempts: 5,
					error: "The endpoint answered HTTP 500",
					channelName: "Ops",
					channelType: "webhook",
				}),
				delivery({
					id: "d3",
					kind: "test",
					status: "pending",
					ruleName: null,
					issueId: null,
					issueTitle: null,
				}),
			],
			total: 3,
			limit: 25,
			offset: 0,
		});
		renderApp(HISTORY);
		const rows = await screen.findAllByTestId("delivery-row");
		expect(rows).toHaveLength(3);
		expect(within(rows[0]).getByText("Sent")).toBeInTheDocument();
		expect(
			within(rows[0]).getByRole("link", { name: "TypeError: x is undefined" }),
		).toHaveAttribute(
			"href",
			`/acme/projects/storefront/issues/${fx.ISSUE_ID}`,
		);
		expect(within(rows[1]).getByText("Failed")).toBeInTheDocument();
		expect(
			within(rows[1]).getByText("The endpoint answered HTTP 500"),
		).toBeInTheDocument();
		expect(within(rows[1]).getByText("5 attempts")).toBeInTheDocument();
		expect(within(rows[2]).getByText("Pending")).toBeInTheDocument();
		expect(within(rows[2]).getByText("Test alert")).toBeInTheDocument();
	});

	it("sin avisos explica qué se verá aquí", async () => {
		vi.mocked(alertsService.listDeliveries).mockResolvedValue({
			items: [],
			total: 0,
			limit: 25,
			offset: 0,
		});
		renderApp(HISTORY);
		expect(await screen.findByText("No alerts sent yet")).toBeInTheDocument();
	});

	it("pide la página que indica la URL", async () => {
		vi.mocked(alertsService.listDeliveries).mockResolvedValue({
			items: [delivery()],
			total: 60,
			limit: 25,
			offset: 25,
		});
		renderApp(`${HISTORY}&page=2`);
		await screen.findByTestId("delivery-row");
		expect(alertsService.listDeliveries).toHaveBeenCalledWith(
			"org-1",
			fx.PROJECT_ID,
			{ limit: 25, offset: 25 },
		);
	});
});
