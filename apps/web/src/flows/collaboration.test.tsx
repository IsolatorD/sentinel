import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { issuesService } from "@/services/issuesService/issuesService";
import { organizationsService } from "@/services/organizationsService/organizationsService";
import * as fx from "@/test/fixtures";
import {
	ISSUE_PATH,
	ISSUES_PATH,
	mockHappyPath,
	renderApp,
} from "@/test/render-app";

vi.mock("@/services/authService/authService");
vi.mock("@/services/configService/configService");
vi.mock("@/services/organizationsService/organizationsService");
vi.mock("@/services/projectsService/projectsService");
vi.mock("@/services/issuesService/issuesService");

const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const luisRef = { id: "u-luis", name: "Luis Gómez", email: "luis@example.com" };
const anaRef = { id: fx.user.id, name: fx.user.name, email: fx.user.email };

const member = (
	id: string,
	userId: string,
	role: string,
	name: string,
	email: string,
) => ({
	id,
	userId,
	role,
	createdAt: new Date(),
	user: { name, email },
});

const comment = (over = {}) => ({
	id: "a1111111-1111-4111-8111-111111111111",
	type: "comment" as const,
	actor: anaRef,
	body: "Lo reviso mañana",
	data: null,
	createdAt: ago(60_000),
	editedAt: null,
	...over,
});

const activityPage = (items: unknown[]) => ({
	items,
	total: items.length,
	limit: 50,
	offset: 0,
});

beforeEach(() => {
	vi.resetAllMocks();
	mockHappyPath();
	vi.mocked(organizationsService.listMembers).mockResolvedValue([
		member("m1", fx.user.id, "member", fx.user.name, fx.user.email),
		member("m2", "u-luis", "member", luisRef.name, luisRef.email),
	]);
	vi.mocked(issuesService.listActivity).mockResolvedValue(
		activityPage([]) as never,
	);
});

describe("responsable de un issue", () => {
	it("muestra quién lo tiene y permite asignarlo a un miembro", async () => {
		const { user } = renderApp(ISSUE_PATH);
		const select = await screen.findByRole("combobox", { name: "Assignee" });
		expect(select).toHaveValue("");
		// Los miembros se cargan aparte: se espera a que aparezca la opción.
		await within(select).findByRole("option", { name: "Luis Gómez" });
		await user.selectOptions(select, "u-luis");
		expect(issuesService.updateStatus).toHaveBeenCalledWith(
			"org-1",
			fx.PROJECT_ID,
			fx.ISSUE_ID,
			{
				assigneeId: "u-luis",
			},
		);
	});

	it("un issue asignado muestra a su responsable y se puede dejar sin asignar", async () => {
		vi.mocked(issuesService.get).mockResolvedValue(
			fx.issueDetail({ assignee: luisRef }),
		);
		const { user } = renderApp(ISSUE_PATH);
		const select = await screen.findByRole("combobox", { name: "Assignee" });
		await waitFor(() => expect(select).toHaveValue("u-luis"));
		await user.selectOptions(select, "");
		expect(issuesService.updateStatus).toHaveBeenCalledWith(
			"org-1",
			fx.PROJECT_ID,
			fx.ISSUE_ID,
			{
				assigneeId: null,
			},
		);
	});

	it("si el responsable ya no está en la lista de miembros, se conserva como opción", async () => {
		vi.mocked(issuesService.get).mockResolvedValue(
			fx.issueDetail({
				assignee: { id: "u-ex", name: "Ex Miembro", email: "ex@example.com" },
			}),
		);
		renderApp(ISSUE_PATH);
		const select = await screen.findByRole("combobox", { name: "Assignee" });
		await waitFor(() => expect(select).toHaveValue("u-ex"));
		expect(
			within(select).getByRole("option", { name: "Ex Miembro" }),
		).toBeInTheDocument();
	});
});

describe("listado por responsable", () => {
	const lastQuery = () => vi.mocked(issuesService.list).mock.calls.at(-1)?.[2];

	it("el filtro ofrece yo, sin asignar y cada miembro, y consulta con lo elegido", async () => {
		const { user, router } = renderApp(ISSUES_PATH);
		await screen.findByTestId("issue-list");
		const select = screen.getByLabelText("Assignee");
		expect(
			within(select)
				.getAllByRole("option")
				.map((o) => o.textContent),
		).toEqual([
			"Everyone",
			"Assigned to me",
			"Unassigned",
			"Ana Pérez",
			"Luis Gómez",
		]);

		await user.selectOptions(select, "me");
		await waitFor(() =>
			expect(lastQuery()).toMatchObject({ assignee: "me", offset: 0 }),
		);
		expect(router.state.location.search).toMatchObject({ assignee: "me" });

		await user.selectOptions(select, "u-luis");
		await waitFor(() =>
			expect(lastQuery()).toMatchObject({ assignee: "u-luis" }),
		);
	});

	it("sale de la URL y 'limpiar filtros' lo quita", async () => {
		vi.mocked(issuesService.list).mockResolvedValue(fx.issueList([]));
		const { user, router } = renderApp(`${ISSUES_PATH}?assignee=unassigned`);
		await waitFor(() =>
			expect(lastQuery()).toMatchObject({ assignee: "unassigned" }),
		);
		await user.click(
			await screen.findByRole("button", { name: "Clear filters" }),
		);
		await waitFor(() =>
			expect(router.state.location.search).not.toHaveProperty("assignee"),
		);
	});

	it("cada fila marca a su responsable", async () => {
		vi.mocked(issuesService.list).mockResolvedValue(
			fx.issueList([fx.issue({ assignee: luisRef })]),
		);
		renderApp(ISSUES_PATH);
		const row = await screen.findByTestId("issue-row");
		expect(within(row).getByText("Assigned to Luis Gómez")).toBeInTheDocument();
	});
});

describe("actividad", () => {
	const ACTIVITY = `${ISSUE_PATH}?tab=activity`;

	it("la pestaña Actividad se refleja en la URL y muestra comentarios y cambios", async () => {
		vi.mocked(issuesService.listActivity).mockResolvedValue(
			activityPage([
				comment(),
				{
					id: "a2",
					type: "assignment",
					actor: anaRef,
					body: null,
					data: { from: null, to: { id: "u-luis", name: "Luis Gómez" } },
					createdAt: ago(120_000),
					editedAt: null,
				},
				{
					id: "a3",
					type: "status",
					actor: luisRef,
					body: null,
					data: {
						from: "unresolved",
						to: "resolved",
						release: "2.5.0",
						inclusive: true,
					},
					createdAt: ago(180_000),
					editedAt: null,
				},
			]) as never,
		);
		const { user, router } = renderApp(ISSUE_PATH);
		await user.click(await screen.findByRole("tab", { name: "Activity" }));
		await waitFor(() =>
			expect(router.state.location.search).toMatchObject({ tab: "activity" }),
		);

		expect(await screen.findByText("Lo reviso mañana")).toBeInTheDocument();
		const events = screen.getAllByTestId("activity-event");
		expect(events[0]).toHaveTextContent(
			"Ana Pérez assigned this issue to Luis Gómez",
		);
		expect(events[1]).toHaveTextContent(
			"Luis Gómez resolved this issue in release 2.5.0",
		);
		expect(issuesService.listActivity).toHaveBeenCalledWith(
			"org-1",
			fx.PROJECT_ID,
			fx.ISSUE_ID,
			{
				limit: 50,
				offset: 0,
			},
		);
	});

	it("sin actividad lo explica", async () => {
		renderApp(ACTIVITY);
		expect(await screen.findByTestId("no-activity")).toBeInTheDocument();
	});

	it("comentar: el botón espera texto, envía el comentario limpio y vacía la caja", async () => {
		vi.mocked(issuesService.addComment).mockResolvedValue(comment() as never);
		const { user } = renderApp(ACTIVITY);
		const box = await screen.findByLabelText("Comment");
		const send = screen.getByRole("button", { name: "Comment" });
		expect(send).toBeDisabled();

		await user.type(box, "  Probando  ");
		await user.click(send);
		expect(issuesService.addComment).toHaveBeenCalledWith(
			"org-1",
			fx.PROJECT_ID,
			fx.ISSUE_ID,
			"Probando",
		);
		await waitFor(() => expect(box).toHaveValue(""));
	});

	it("Ctrl+Enter también envía", async () => {
		vi.mocked(issuesService.addComment).mockResolvedValue(comment() as never);
		const { user } = renderApp(ACTIVITY);
		await user.type(
			await screen.findByLabelText("Comment"),
			"Atajo{Control>}{Enter}{/Control}",
		);
		expect(issuesService.addComment).toHaveBeenCalledWith(
			"org-1",
			fx.PROJECT_ID,
			fx.ISSUE_ID,
			"Atajo",
		);
	});

	it("el autor edita su comentario y se marca como editado", async () => {
		vi.mocked(issuesService.listActivity).mockResolvedValue(
			activityPage([comment()]) as never,
		);
		vi.mocked(issuesService.editComment).mockResolvedValue(
			comment({ body: "Corregido" }) as never,
		);
		const { user } = renderApp(ACTIVITY);
		await user.click(
			await screen.findByRole("button", { name: "Edit comment" }),
		);
		const editor = screen
			.getAllByLabelText("Edit comment")
			.find((e) => e.tagName === "TEXTAREA") as HTMLElement;
		expect(editor).toHaveValue("Lo reviso mañana");
		await user.clear(editor);
		await user.type(editor, "Corregido");
		await user.click(screen.getByRole("button", { name: "Save changes" }));
		expect(issuesService.editComment).toHaveBeenCalledWith(
			"org-1",
			fx.PROJECT_ID,
			fx.ISSUE_ID,
			comment().id,
			"Corregido",
		);
	});

	it("borrar un comentario pide confirmación", async () => {
		vi.mocked(issuesService.listActivity).mockResolvedValue(
			activityPage([comment()]) as never,
		);
		vi.mocked(issuesService.deleteComment).mockResolvedValue(undefined);
		const { user } = renderApp(ACTIVITY);
		await user.click(
			await screen.findByRole("button", { name: "Delete comment" }),
		);
		const dialog = await screen.findByRole("dialog");
		expect(issuesService.deleteComment).not.toHaveBeenCalled();
		await user.click(
			within(dialog).getByRole("button", { name: "Delete comment" }),
		);
		expect(issuesService.deleteComment).toHaveBeenCalledWith(
			"org-1",
			fx.PROJECT_ID,
			fx.ISSUE_ID,
			comment().id,
		);
	});

	it("el comentario de otra persona solo se puede borrar si eres admin, y nunca editar", async () => {
		const other = comment({ actor: luisRef, body: "De Luis" });
		vi.mocked(issuesService.listActivity).mockResolvedValue(
			activityPage([other]) as never,
		);

		// Miembro corriente: sin acciones.
		const first = renderApp(ACTIVITY);
		await screen.findByText("De Luis");
		expect(
			screen.queryByRole("button", { name: "Delete comment" }),
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Edit comment" }),
		).not.toBeInTheDocument();
		first.unmount();

		// Admin: puede borrar, pero no editar.
		vi.mocked(organizationsService.listMembers).mockResolvedValue([
			member("m1", fx.user.id, "admin", fx.user.name, fx.user.email),
			member("m2", "u-luis", "member", luisRef.name, luisRef.email),
		]);
		renderApp(ACTIVITY);
		expect(
			await screen.findByRole("button", { name: "Delete comment" }),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Edit comment" }),
		).not.toBeInTheDocument();
	});

	it("si falla la carga, ofrece reintentar", async () => {
		vi.mocked(issuesService.listActivity).mockRejectedValue(new Error("boom"));
		renderApp(ACTIVITY);
		expect(
			await screen.findByText("Could not load the activity."),
		).toBeInTheDocument();
	});
});
