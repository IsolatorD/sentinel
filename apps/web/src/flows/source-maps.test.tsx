import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-error";
import { releasesService } from "@/services/releases.service";
import { tokensService } from "@/services/tokens.service";
import * as fx from "@/test/fixtures";
import { ISSUE_PATH, mockHappyPath, renderApp } from "@/test/render-app";

vi.mock("@/services/auth.service");
vi.mock("@/services/config.service");
vi.mock("@/services/organizations.service");
vi.mock("@/services/projects.service");
vi.mock("@/services/issues.service");
vi.mock("@/services/releases.service");
vi.mock("@/services/tokens.service");

const RELEASES_PATH = "/acme/projects/storefront/releases";
const TOKENS_PATH = "/acme/tokens";
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

const token = (over = {}) => ({
	id: "t1",
	name: "GitHub Actions",
	prefix: "snt_a1b2c3d4",
	createdAt: ago(3600_000),
	lastUsedAt: null,
	...over,
});

const artifact = (over = {}) => ({
	id: "a1",
	name: "~/assets/app.3f2a.js",
	size: 2048,
	sha256: "x".repeat(64),
	createdAt: ago(60_000),
	...over,
});

beforeEach(() => {
	vi.resetAllMocks();
	mockHappyPath();
	vi.mocked(releasesService.list).mockResolvedValue([
		{
			version: "2.4.0",
			createdAt: ago(3600_000),
			eventCount: 5,
			newIssueCount: 1,
			artifactCount: 1,
			firstEventAt: null,
			lastEventAt: null,
		},
	]);
	vi.mocked(releasesService.environments).mockResolvedValue([]);
	vi.mocked(releasesService.artifacts).mockResolvedValue([artifact()]);
	vi.mocked(tokensService.list).mockResolvedValue([token()]);
});

describe("tokens de API", () => {
	it("el menú lateral lleva a la página y lista los tokens sin su valor", async () => {
		const { user, router } = renderApp("/acme/projects/storefront/issues");
		await user.click(await screen.findByRole("link", { name: "API tokens" }));
		await waitFor(() =>
			expect(router.state.location.pathname).toBe(TOKENS_PATH),
		);
		const row = await screen.findByTestId("token-row");
		expect(within(row).getByText("GitHub Actions")).toBeInTheDocument();
		expect(within(row).getByText("snt_a1b2c3d4…")).toBeInTheDocument();
		expect(within(row).getByText("Never used")).toBeInTheDocument();
		expect(tokensService.list).toHaveBeenCalledWith("org-1");
	});

	it("crear un token muestra su valor completo una sola vez", async () => {
		vi.mocked(tokensService.create).mockResolvedValue({
			...token({ id: "t2", name: "Deploys" }),
			token: `snt_${"f".repeat(48)}`,
		});
		const { user } = renderApp(TOKENS_PATH);
		await screen.findByTestId("token-row");

		const create = screen.getByRole("button", { name: "Create token" });
		expect(create).toBeDisabled();
		await user.type(screen.getByLabelText("Token name"), "  Deploys ");
		await user.click(create);

		expect(tokensService.create).toHaveBeenCalledWith("org-1", "Deploys");
		const dialog = await screen.findByRole("dialog");
		expect(within(dialog).getByTestId("new-token")).toHaveTextContent(
			`snt_${"f".repeat(48)}`,
		);

		await user.click(within(dialog).getByRole("button", { name: "Done" }));
		await waitFor(() =>
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
		);
		expect(screen.queryByText(/ffffffff/)).not.toBeInTheDocument();
		// El formulario queda limpio y la lista se vuelve a pedir.
		expect(screen.getByLabelText("Token name")).toHaveValue("");
		expect(tokensService.list).toHaveBeenCalledTimes(2);
	});

	it("revocar pide confirmación", async () => {
		vi.mocked(tokensService.revoke).mockResolvedValue(undefined);
		const { user } = renderApp(TOKENS_PATH);
		await user.click(
			await screen.findByRole("button", { name: "Revoke GitHub Actions" }),
		);
		const dialog = await screen.findByRole("dialog");
		expect(
			within(dialog).getByText("Revoke GitHub Actions?"),
		).toBeInTheDocument();
		expect(tokensService.revoke).not.toHaveBeenCalled();
		await user.click(within(dialog).getByRole("button", { name: "Revoke" }));
		expect(tokensService.revoke).toHaveBeenCalledWith("org-1", "t1");
	});

	it("sin tokens invita a crear el primero", async () => {
		vi.mocked(tokensService.list).mockResolvedValue([]);
		renderApp(TOKENS_PATH);
		expect(await screen.findByText("No API tokens yet")).toBeInTheDocument();
	});

	it("un member ve que no tiene permisos en lugar de un error genérico", async () => {
		vi.mocked(tokensService.list).mockRejectedValue(
			new ApiError(403, "Insufficient permissions"),
		);
		renderApp(TOKENS_PATH);
		expect(
			await screen.findByText("Only owners and admins can manage API tokens."),
		).toBeInTheDocument();
	});
});

describe("archivos de una release", () => {
	const open = async (user: ReturnType<typeof renderApp>["user"]) => {
		await user.click(
			await screen.findByRole("button", { name: "Files of release 2.4.0" }),
		);
		return screen.findByRole("dialog");
	};

	it("lista los source maps con su tamaño y el comando para subir más", async () => {
		const { user } = renderApp(RELEASES_PATH);
		const dialog = await open(user);

		const row = await within(dialog).findByTestId("file-row");
		expect(within(row).getByText("~/assets/app.3f2a.js")).toBeInTheDocument();
		expect(within(row).getByText(/2 KB/)).toBeInTheDocument();
		expect(releasesService.artifacts).toHaveBeenCalledWith(
			"org-1",
			fx.PROJECT_ID,
			"2.4.0",
		);

		const code = dialog.querySelector("code")?.textContent ?? "";
		expect(code).toContain("SENTINEL_ORG='org-1'");
		expect(code).toContain(`SENTINEL_PROJECT='${fx.PROJECT_ID}'`);
		expect(code).toContain("--release '2.4.0'");
		expect(code).toContain("<your-api-token>");
	});

	it("sin archivos explica que hay que subirlos antes de desplegar", async () => {
		vi.mocked(releasesService.artifacts).mockResolvedValue([]);
		const { user } = renderApp(RELEASES_PATH);
		const dialog = await open(user);
		expect(await within(dialog).findByTestId("no-files")).toHaveTextContent(
			/before deploying/,
		);
	});

	it("borrar un archivo lo quita y refresca los contadores", async () => {
		vi.mocked(releasesService.removeArtifact).mockResolvedValue(undefined);
		const { user } = renderApp(RELEASES_PATH);
		const dialog = await open(user);
		await user.click(
			await within(dialog).findByRole("button", {
				name: "Delete ~/assets/app.3f2a.js",
			}),
		);
		expect(releasesService.removeArtifact).toHaveBeenCalledWith(
			"org-1",
			fx.PROJECT_ID,
			"2.4.0",
			"a1",
		);
		await waitFor(() => expect(releasesService.list).toHaveBeenCalledTimes(2));
	});

	it("sin permisos para borrar muestra un mensaje claro", async () => {
		vi.mocked(releasesService.removeArtifact).mockRejectedValue(
			new ApiError(403, "Insufficient permissions"),
		);
		const { user } = renderApp(RELEASES_PATH);
		const dialog = await open(user);
		await user.click(
			await within(dialog).findByRole("button", {
				name: "Delete ~/assets/app.3f2a.js",
			}),
		);
		expect(
			await within(dialog).findByText(
				"Only owners and admins can delete files.",
			),
		).toBeInTheDocument();
	});
});

describe("stack trace con código original", () => {
	const symbolicated = {
		...fx.eventPayload,
		exception: {
			values: [
				{
					type: "TypeError",
					value: "x is undefined",
					stacktrace: {
						frames: [
							{
								filename: "src/cart/total.ts",
								function: "CartPage",
								lineno: 20,
								colno: 3,
								in_app: true,
								symbolicated: true,
								abs_path: "https://shop.acme.dev/assets/app.js",
								context_line: "return render(cart);",
								pre_context: ["function CartPage() {"],
								post_context: ["}"],
							},
							{
								filename: "src/cart/total.ts",
								function: "computeTotal",
								lineno: 42,
								colno: 17,
								in_app: true,
								symbolicated: true,
								abs_path: "https://shop.acme.dev/assets/app.js",
								context_line: "return items.reduce(sum);",
								pre_context: ["const items = cart.items;"],
								post_context: [],
							},
						],
					},
				},
			],
		},
	};

	beforeEach(async () => {
		const { issuesService } = await import("@/services/issues.service");
		vi.mocked(issuesService.get).mockResolvedValue(
			fx.issueDetail({
				latestEvent: fx.event({ payload: symbolicated }),
			}),
		);
	});

	it("muestra la ruta del proyecto y abre el código del punto donde falló", async () => {
		renderApp(ISSUE_PATH);
		const block = await screen.findByTestId("exception-block");
		const frames = within(block).getAllByRole("listitem");
		// El último frame (donde se lanzó) va primero.
		expect(frames[0]).toHaveTextContent(
			"src/cart/total.ts:42:17 in computeTotal",
		);

		// Su código viene abierto, con la línea que falló resaltada y numerada.
		const code = within(frames[0]).getByTestId("code-context");
		expect(code).toHaveTextContent("41const items = cart.items;");
		const failing = code.querySelector('[data-highlight="true"]');
		expect(failing).toHaveTextContent("42return items.reduce(sum);");

		// El resto está cerrado hasta que se pida.
		expect(within(frames[1]).queryByTestId("code-context")).toBeNull();
	});

	it("cada frame con código se puede abrir y cerrar", async () => {
		const { user } = renderApp(ISSUE_PATH);
		const block = await screen.findByTestId("exception-block");
		const [top, second] = within(block).getAllByRole("listitem");

		await user.click(within(second).getByRole("button", { name: /Show code/ }));
		expect(within(second).getByTestId("code-context")).toHaveTextContent(
			"return render(cart);",
		);

		await user.click(within(top).getByRole("button", { name: /Hide code/ }));
		expect(within(top).queryByTestId("code-context")).toBeNull();
	});

	it("los frames sin source map no tienen contenido que abrir", async () => {
		const { issuesService } = await import("@/services/issues.service");
		vi.mocked(issuesService.get).mockResolvedValue(fx.issueDetail());
		renderApp(ISSUE_PATH);
		const blocks = await screen.findAllByTestId("exception-block");
		for (const frame of within(blocks[0]).getAllByRole("listitem")) {
			expect(within(frame).queryByRole("button")).toBeNull();
		}
		expect(screen.queryByTestId("code-context")).toBeNull();
	});
});
