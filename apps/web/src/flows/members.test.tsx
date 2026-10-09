import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authService } from "@/services/authService/authService";
import { organizationsService } from "@/services/organizationsService/organizationsService";
import * as fx from "@/test/fixtures";
import { mockHappyPath, renderApp } from "@/test/render-app";
import { ApiError } from "@/utils/apiError/apiError";

vi.mock("@/services/authService/authService");
vi.mock("@/services/configService/configService");
vi.mock("@/services/organizationsService/organizationsService");
vi.mock("@/services/projectsService/projectsService");
vi.mock("@/services/issuesService/issuesService");

const PATH = "/acme/members";
const ago = (ms: number) => new Date(Date.now() - ms);

const member = (over = {}) => ({
	id: "m-ana",
	userId: fx.user.id,
	role: "owner",
	createdAt: ago(86_400_000),
	user: { name: fx.user.name, email: fx.user.email },
	...over,
});
const luis = member({
	id: "m-luis",
	userId: "u-luis",
	role: "member",
	user: { name: "Luis Gómez", email: "luis@example.com" },
});

const invitation = (over = {}) => ({
	id: "inv-1",
	email: "nuevo@example.com",
	role: "member",
	status: "pending",
	expiresAt: new Date(Date.now() + 86_400_000),
	...over,
});

beforeEach(() => {
	vi.resetAllMocks();
	mockHappyPath();
	vi.mocked(organizationsService.listMembers).mockResolvedValue([
		member(),
		luis,
	]);
	vi.mocked(organizationsService.listInvitations).mockResolvedValue([
		invitation(),
	]);
});

describe("miembros", () => {
	it("el menú lleva a la lista de miembros, con su rol y marcando quién eres", async () => {
		const { user, router } = renderApp("/acme/projects/storefront/issues");
		await user.click(await screen.findByRole("link", { name: "Members" }));
		await waitFor(() => expect(router.state.location.pathname).toBe(PATH));

		const rows = await screen.findAllByTestId("member-row");
		expect(rows).toHaveLength(2);
		expect(within(rows[0]).getByText("Ana Pérez")).toBeInTheDocument();
		expect(within(rows[0]).getByText("You")).toBeInTheDocument();
		expect(within(rows[0]).getByText("Owner")).toBeInTheDocument();
		expect(within(rows[1]).getByText("luis@example.com")).toBeInTheDocument();
	});

	it("un admin puede cambiar el rol de otro miembro, pero no el suyo ni el del owner", async () => {
		vi.mocked(organizationsService.updateMemberRole).mockResolvedValue(
			undefined,
		);
		const { user } = renderApp(PATH);
		const rows = await screen.findAllByTestId("member-row");
		expect(within(rows[0]).queryByRole("combobox")).not.toBeInTheDocument();
		expect(within(rows[0]).queryByRole("button")).not.toBeInTheDocument();

		await user.selectOptions(within(rows[1]).getByRole("combobox"), "admin");
		expect(organizationsService.updateMemberRole).toHaveBeenCalledWith(
			"org-1",
			"m-luis",
			"admin",
		);
	});

	it("quitar a alguien pide confirmación", async () => {
		vi.mocked(organizationsService.removeMember).mockResolvedValue(undefined);
		const { user } = renderApp(PATH);
		await user.click(
			await screen.findByRole("button", { name: "Remove Luis Gómez" }),
		);
		const dialog = await screen.findByRole("dialog");
		expect(organizationsService.removeMember).not.toHaveBeenCalled();
		await user.click(within(dialog).getByRole("button", { name: "Remove" }));
		expect(organizationsService.removeMember).toHaveBeenCalledWith(
			"org-1",
			"m-luis",
		);
	});

	it("un miembro corriente ve la lista, pero no puede invitar ni ve las invitaciones", async () => {
		vi.mocked(organizationsService.listMembers).mockResolvedValue([
			member({
				role: "owner",
				userId: "u-boss",
				id: "m-boss",
				user: { name: "Jefa", email: "jefa@example.com" },
			}),
			member({ role: "member" }),
		]);
		renderApp(PATH);
		await screen.findAllByTestId("member-row");
		expect(
			screen.queryByRole("button", { name: "Invite" }),
		).not.toBeInTheDocument();
		expect(screen.queryByText("Pending invitations")).not.toBeInTheDocument();
		expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
	});

	it("invitar valida el correo y envía el rol elegido", async () => {
		vi.mocked(organizationsService.inviteMember).mockResolvedValue(undefined);
		const { user } = renderApp(PATH);
		await user.click(await screen.findByRole("button", { name: "Invite" }));
		const dialog = await screen.findByRole("dialog");

		await user.type(within(dialog).getByLabelText("Email"), "no-es-correo");
		await user.click(
			within(dialog).getByRole("button", { name: "Send invitation" }),
		);
		expect(await within(dialog).findByText(/valid email/i)).toBeInTheDocument();
		expect(organizationsService.inviteMember).not.toHaveBeenCalled();

		await user.clear(within(dialog).getByLabelText("Email"));
		await user.type(
			within(dialog).getByLabelText("Email"),
			"  nueva@example.com ",
		);
		await user.selectOptions(within(dialog).getByLabelText("Role"), "admin");
		await user.click(
			within(dialog).getByRole("button", { name: "Send invitation" }),
		);
		await waitFor(() =>
			expect(organizationsService.inviteMember).toHaveBeenCalledWith({
				organizationId: "org-1",
				email: "nueva@example.com",
				role: "admin",
			}),
		);
		await waitFor(() =>
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
		);
	});

	it("si el servidor rechaza la invitación, lo explica", async () => {
		vi.mocked(organizationsService.inviteMember).mockRejectedValue(
			new ApiError(400, "User is already invited to this organization"),
		);
		const { user } = renderApp(PATH);
		await user.click(await screen.findByRole("button", { name: "Invite" }));
		const dialog = await screen.findByRole("dialog");
		await user.type(within(dialog).getByLabelText("Email"), "dup@example.com");
		await user.click(
			within(dialog).getByRole("button", { name: "Send invitation" }),
		);
		expect(
			await within(dialog).findByText(/already has a pending invitation/),
		).toBeInTheDocument();
	});

	it("lista las invitaciones pendientes y permite reenviar o cancelar", async () => {
		vi.mocked(organizationsService.inviteMember).mockResolvedValue(undefined);
		vi.mocked(organizationsService.cancelInvitation).mockResolvedValue(
			undefined,
		);
		const { user } = renderApp(PATH);
		const row = await screen.findByTestId("invitation-row");
		expect(within(row).getByText("nuevo@example.com")).toBeInTheDocument();

		await user.click(within(row).getByRole("button", { name: "Resend" }));
		expect(organizationsService.inviteMember).toHaveBeenCalledWith({
			organizationId: "org-1",
			email: "nuevo@example.com",
			role: "member",
			resend: true,
		});
		expect(
			await screen.findByText("Invitation sent again"),
		).toBeInTheDocument();

		await user.click(
			within(row).getByRole("button", {
				name: "Cancel invitation to nuevo@example.com",
			}),
		);
		expect(organizationsService.cancelInvitation).toHaveBeenCalledWith("inv-1");
	});

	it("sin invitaciones pendientes lo dice", async () => {
		vi.mocked(organizationsService.listInvitations).mockResolvedValue([]);
		renderApp(PATH);
		expect(
			await screen.findByText("No pending invitations"),
		).toBeInTheDocument();
	});
});

describe("aceptar una invitación", () => {
	const INVITE = "/accept-invitation/inv-1";
	const publicInvitation = (over = {}) => ({
		id: "inv-1",
		email: fx.user.email,
		role: "admin",
		status: "pending",
		organizationName: "Globex",
		organizationSlug: "globex",
		inviterEmail: "jefa@globex.dev",
		...over,
	});

	it("muestra quién invita, a qué organización y con qué rol", async () => {
		vi.mocked(organizationsService.getInvitation).mockResolvedValue(
			publicInvitation(),
		);
		renderApp(INVITE);
		const card = await screen.findByTestId("invitation-card");
		expect(card).toHaveTextContent(
			"jefa@globex.dev invited you to join Globex as Admin.",
		);
		expect(organizationsService.getInvitation).toHaveBeenCalledWith("inv-1");
	});

	it("aceptar entra a la organización nueva", async () => {
		vi.mocked(organizationsService.getInvitation).mockResolvedValue(
			publicInvitation(),
		);
		vi.mocked(organizationsService.acceptInvitation).mockResolvedValue(
			undefined,
		);
		vi.mocked(organizationsService.list).mockResolvedValue([
			fx.org,
			{ id: "org-2", name: "Globex", slug: "globex", logo: null },
		]);
		const { user, router } = renderApp(INVITE);
		await user.click(
			await screen.findByRole("button", { name: "Accept invitation" }),
		);
		expect(organizationsService.acceptInvitation).toHaveBeenCalledWith("inv-1");
		await waitFor(() =>
			expect(router.state.location.pathname).toMatch(/^\/globex/),
		);
	});

	it("rechazar no entra y vuelve al inicio", async () => {
		vi.mocked(organizationsService.getInvitation).mockResolvedValue(
			publicInvitation(),
		);
		vi.mocked(organizationsService.rejectInvitation).mockResolvedValue(
			undefined,
		);
		const { user } = renderApp(INVITE);
		await user.click(await screen.findByRole("button", { name: "Decline" }));
		expect(organizationsService.rejectInvitation).toHaveBeenCalledWith("inv-1");
		expect(organizationsService.acceptInvitation).not.toHaveBeenCalled();
	});

	it("si la invitación es para otra cuenta, lo explica y ofrece cambiar de cuenta", async () => {
		vi.mocked(organizationsService.getInvitation).mockRejectedValue(
			new ApiError(403, "You are not the recipient of the invitation"),
		);
		// Al salir, la sesión deja de existir.
		vi.mocked(authService.signOut).mockImplementation(async () => {
			vi.mocked(authService.getSession).mockResolvedValue(null);
		});
		const { user, router } = renderApp(INVITE);
		const box = await screen.findByTestId("invitation-error");
		expect(box).toHaveTextContent(/different email address/);
		expect(box).toHaveTextContent(fx.user.email);

		await user.click(
			within(box).getByRole("button", { name: "Sign in with another account" }),
		);
		await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
		expect(router.state.location.search).toMatchObject({ redirect: INVITE });
	});

	it("una invitación inexistente o caducada se explica", async () => {
		vi.mocked(organizationsService.getInvitation).mockRejectedValue(
			new ApiError(400, "Invitation not found"),
		);
		renderApp(INVITE);
		expect(
			await screen.findByText("This invitation does not exist or has expired."),
		).toBeInTheDocument();
	});

	it("una invitación ya usada o cancelada no se puede aceptar", async () => {
		vi.mocked(organizationsService.getInvitation).mockResolvedValue(
			publicInvitation({ status: "canceled" }),
		);
		renderApp(INVITE);
		expect(
			await screen.findByText("This invitation was already used or cancelled."),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Accept invitation" }),
		).not.toBeInTheDocument();
	});
});

describe("volver a donde ibas tras iniciar sesión", () => {
	it("sin sesión, el enlace de una invitación pasa por el login y vuelve a ella", async () => {
		vi.mocked(authService.getSession)
			.mockResolvedValueOnce(null)
			.mockResolvedValue({ user: fx.user });
		vi.mocked(authService.signInEmail).mockResolvedValue(undefined);
		vi.mocked(organizationsService.getInvitation).mockResolvedValue({
			id: "inv-1",
			email: fx.user.email,
			role: "member",
			status: "pending",
			organizationName: "Globex",
			organizationSlug: "globex",
			inviterEmail: "jefa@globex.dev",
		});
		const { user, router } = renderApp("/accept-invitation/inv-1");
		await screen.findByRole("button", { name: "Sign in" });
		expect(router.state.location.pathname).toBe("/login");
		expect(router.state.location.search).toMatchObject({
			redirect: "/accept-invitation/inv-1",
		});

		await user.type(screen.getByLabelText("Email"), fx.user.email);
		await user.type(screen.getByLabelText("Password"), "clave-correcta-1");
		await user.click(screen.getByRole("button", { name: "Sign in" }));
		expect(await screen.findByTestId("invitation-card")).toBeInTheDocument();
		expect(router.state.location.pathname).toBe("/accept-invitation/inv-1");
	});

	it("un destino externo en la URL se ignora (no hay redirección abierta)", async () => {
		vi.mocked(authService.getSession)
			.mockResolvedValueOnce(null)
			.mockResolvedValue({ user: fx.user });
		vi.mocked(authService.signInEmail).mockResolvedValue(undefined);
		const { user, router } = renderApp(
			"/login?redirect=https://evil.example.com/steal",
		);
		await user.type(await screen.findByLabelText("Email"), fx.user.email);
		await user.type(screen.getByLabelText("Password"), "clave-correcta-1");
		await user.click(screen.getByRole("button", { name: "Sign in" }));
		await screen.findByText(fx.issue().title);
		expect(router.state.location.pathname).toBe(
			"/acme/projects/storefront/issues",
		);
		expect(router.state.location.href).not.toContain("evil");
	});
});
