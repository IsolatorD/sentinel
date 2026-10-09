import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { OrgAccessService } from "../organizations/org-access.service.js";
import type { OrganizationsRepository } from "../organizations/organizations.repository.js";
import type { ProjectsService } from "../projects/projects.service.js";
import type { ReleasesService } from "../releases/releases.service.js";
import type {
	EventRow,
	IssueEventsRepository,
} from "./issue-events.repository.js";
import type { IssueRow, IssuesRepository } from "./issues.repository.js";
import { IssuesService } from "./issues.service.js";

const ISSUE_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const EVENT_ID = "33333333-3333-4333-8333-333333333333";
const at = new Date("2026-10-09T12:00:00Z");

const issueRow = (over: Partial<IssueRow> = {}): IssueRow => ({
	id: ISSUE_ID,
	projectId: PROJECT_ID,
	fingerprint: "abc",
	title: "TypeError: x",
	culprit: "fn (a.js:1)",
	type: "TypeError",
	level: "error",
	status: "unresolved",
	firstRelease: null,
	lastRelease: null,
	resolvedRelease: null,
	resolvedInclusive: false,
	regressedAt: null,
	regressedInRelease: null,
	eventCount: 3,
	firstSeen: at,
	lastSeen: at,
	createdAt: at,
	...over,
});

const eventRow = (over: Partial<EventRow> = {}): EventRow => ({
	id: EVENT_ID,
	projectId: PROJECT_ID,
	issueId: ISSUE_ID,
	timestamp: at,
	receivedAt: at,
	level: "error",
	type: "TypeError",
	message: "x",
	release: "1.0.0",
	environment: "prod",
	platform: "javascript",
	userIdentifier: "u1",
	payload: { exception: { values: [] } },
	...over,
});

function setup(
	role: string | undefined,
	deps: {
		issues?: Partial<IssuesRepository>;
		events?: Partial<IssueEventsRepository>;
		projectExists?: boolean;
		latestRelease?: string;
	} = {},
) {
	const access = new OrgAccessService({
		findMemberRole: async () => role,
	} as unknown as OrganizationsRepository);
	const projects = {
		ensureExists: vi.fn(async () => {
			if (deps.projectExists === false)
				throw new NotFoundException("Project not found");
		}),
	} as unknown as ProjectsService;
	const releases = {
		latestVersion: vi.fn(async () => deps.latestRelease),
		ensure: vi.fn(async () => {}),
	};
	const issues = { userCounts: vi.fn(async () => new Map()), ...deps.issues };
	const events = { ...deps.events };
	return {
		service: new IssuesService(
			issues as unknown as IssuesRepository,
			events as unknown as IssueEventsRepository,
			access,
			projects,
			releases as unknown as ReleasesService,
		),
		releases,
		issues,
		events,
		projects,
	};
}

const query = {
	status: "unresolved",
	sort: "lastSeen",
	order: "desc",
	limit: 25,
	offset: 0,
} as const;

describe("IssuesService: acceso", () => {
	it("un no miembro recibe 404 y no se toca la base de datos", async () => {
		const list = vi.fn();
		const { service } = setup(undefined, { issues: { list } });
		await expect(
			service.list("u", "org", PROJECT_ID, query),
		).rejects.toBeInstanceOf(NotFoundException);
		expect(list).not.toHaveBeenCalled();
	});

	it("un proyecto de otra organización se trata como inexistente", async () => {
		const list = vi.fn();
		const { service } = setup("owner", {
			projectExists: false,
			issues: { list },
		});
		await expect(
			service.list("u", "org", PROJECT_ID, query),
		).rejects.toBeInstanceOf(NotFoundException);
		await expect(
			service.get("u", "org", PROJECT_ID, ISSUE_ID),
		).rejects.toBeInstanceOf(NotFoundException);
		expect(list).not.toHaveBeenCalled();
	});

	it("un miembro simple puede ver y cambiar el estado, pero no borrar", async () => {
		const del = vi.fn();
		const { service } = setup("member", {
			issues: {
				list: vi.fn(async () => ({ rows: [], total: 0 })),
				updateStatus: vi.fn(async () => issueRow({ status: "resolved" })),
				delete: del,
			},
		});
		await expect(
			service.list("u", "org", PROJECT_ID, query),
		).resolves.toBeDefined();
		await expect(
			service.updateStatus("u", "org", PROJECT_ID, ISSUE_ID, {
				status: "resolved",
			}),
		).resolves.toMatchObject({
			status: "resolved",
		});
		await expect(
			service.remove("u", "org", PROJECT_ID, ISSUE_ID),
		).rejects.toBeInstanceOf(ForbiddenException);
		expect(del).not.toHaveBeenCalled();
	});
});

describe("IssuesService.list", () => {
	it("mapea filas a DTO con fechas ISO y usuarios afectados (0 si no hay)", async () => {
		const { service, issues } = setup("member", {
			issues: {
				list: vi.fn(async () => ({
					rows: [
						issueRow(),
						issueRow({ id: "44444444-4444-4444-8444-444444444444" }),
					],
					total: 7,
				})),
				userCounts: vi.fn(async () => new Map([[ISSUE_ID, 5]])),
			},
		});
		const result = await service.list("u", "org", PROJECT_ID, {
			...query,
			limit: 2,
			offset: 4,
		});

		expect(result).toMatchObject({ total: 7, limit: 2, offset: 4 });
		expect(result.items[0]).toMatchObject({
			id: ISSUE_ID,
			status: "unresolved",
			eventCount: 3,
			userCount: 5,
			firstSeen: "2026-10-09T12:00:00.000Z",
		});
		expect(result.items[1].userCount).toBe(0);
		// Una sola consulta agrupada para los usuarios, no una por issue.
		expect(issues.userCounts).toHaveBeenCalledTimes(1);
		expect(issues.userCounts).toHaveBeenCalledWith([
			ISSUE_ID,
			"44444444-4444-4444-8444-444444444444",
		]);
	});
});

describe("IssuesService.get", () => {
	it("incluye el último evento completo, o null si no hay", async () => {
		const withEvent = setup("member", {
			issues: { findInProject: vi.fn(async () => issueRow()) },
			events: { latest: vi.fn(async () => eventRow()) },
		});
		const detail = await withEvent.service.get(
			"u",
			"org",
			PROJECT_ID,
			ISSUE_ID,
		);
		expect(detail.latestEvent).toMatchObject({
			id: EVENT_ID,
			payload: { exception: { values: [] } },
		});

		const without = setup("member", {
			issues: { findInProject: vi.fn(async () => issueRow()) },
			events: { latest: vi.fn(async () => undefined) },
		});
		expect(
			(await without.service.get("u", "org", PROJECT_ID, ISSUE_ID)).latestEvent,
		).toBeNull();
	});

	it("un issue inexistente (o de otro proyecto) da 404", async () => {
		const { service, issues } = setup("member", {
			issues: { findInProject: vi.fn(async () => undefined) },
		});
		await expect(
			service.get("u", "org", PROJECT_ID, ISSUE_ID),
		).rejects.toBeInstanceOf(NotFoundException);
		expect(issues.findInProject).toHaveBeenCalledWith(PROJECT_ID, ISSUE_ID);
	});
});

describe("IssuesService: cambios y borrado", () => {
	it("cambiar el estado de un issue inexistente da 404", async () => {
		const { service } = setup("member", {
			issues: { updateStatus: vi.fn(async () => undefined) },
		});
		await expect(
			service.updateStatus("u", "org", PROJECT_ID, ISSUE_ID, {
				status: "ignored",
			}),
		).rejects.toBeInstanceOf(NotFoundException);
	});

	it("un admin borra; si no existe, 404", async () => {
		const ok = setup("admin", { issues: { delete: vi.fn(async () => true) } });
		await expect(
			ok.service.remove("u", "org", PROJECT_ID, ISSUE_ID),
		).resolves.toBeUndefined();

		const missing = setup("owner", {
			issues: { delete: vi.fn(async () => false) },
		});
		await expect(
			missing.service.remove("u", "org", PROJECT_ID, ISSUE_ID),
		).rejects.toBeInstanceOf(NotFoundException);
	});
});

describe("IssuesService: eventos", () => {
	it("lista resúmenes sin el payload completo", async () => {
		const { service } = setup("member", {
			issues: { findInProject: vi.fn(async () => issueRow()) },
			events: { list: vi.fn(async () => ({ rows: [eventRow()], total: 1 })) },
		});
		const result = await service.listEvents("u", "org", PROJECT_ID, ISSUE_ID, {
			limit: 25,
			offset: 0,
		});
		expect(result.total).toBe(1);
		expect(result.items[0]).toMatchObject({
			id: EVENT_ID,
			userIdentifier: "u1",
			release: "1.0.0",
		});
		expect(result.items[0]).not.toHaveProperty("payload");
	});

	it("el detalle de un evento incluye el payload; si no existe, 404", async () => {
		const found = setup("member", {
			issues: { findInProject: vi.fn(async () => issueRow()) },
			events: { find: vi.fn(async () => eventRow()) },
		});
		await expect(
			found.service.getEvent("u", "org", PROJECT_ID, ISSUE_ID, EVENT_ID),
		).resolves.toHaveProperty("payload");

		const missing = setup("member", {
			issues: { findInProject: vi.fn(async () => issueRow()) },
			events: { find: vi.fn(async () => undefined) },
		});
		await expect(
			missing.service.getEvent("u", "org", PROJECT_ID, ISSUE_ID, EVENT_ID),
		).rejects.toBeInstanceOf(NotFoundException);
	});

	it("no se pueden leer eventos de un issue que no pertenece al proyecto", async () => {
		const find = vi.fn();
		const { service } = setup("member", {
			issues: { findInProject: vi.fn(async () => undefined) },
			events: { find },
		});
		await expect(
			service.getEvent("u", "org", PROJECT_ID, ISSUE_ID, EVENT_ID),
		).rejects.toBeInstanceOf(NotFoundException);
		expect(find).not.toHaveBeenCalled();
	});
});

describe("IssuesService.updateStatus: resolución ligada a una release", () => {
	const run = async (
		input: Parameters<IssuesService["updateStatus"]>[4],
		latestRelease?: string,
	) => {
		const updateStatus = vi.fn(async (..._args: unknown[]) => issueRow());
		const ctx = setup("member", { latestRelease, issues: { updateStatus } });
		await ctx.service.updateStatus("u", "org", PROJECT_ID, ISSUE_ID, input);
		return { change: updateStatus.mock.calls[0]?.[2], releases: ctx.releases };
	};

	it("sin `resolution`, cualquier evento nuevo reabrirá el issue", async () => {
		const { change } = await run({ status: "resolved" }, "2.4.0");
		expect(change).toEqual({
			status: "resolved",
			resolvedRelease: null,
			resolvedInclusive: false,
		});
	});

	it("'próxima release' toma como referencia la última release conocida, de forma no inclusiva", async () => {
		const { change } = await run(
			{ status: "resolved", resolution: { type: "next_release" } },
			"2.4.0",
		);
		expect(change).toEqual({
			status: "resolved",
			resolvedRelease: "2.4.0",
			resolvedInclusive: false,
		});
	});

	it("'próxima release' en un proyecto sin releases no tiene referencia (reabre con cualquier evento)", async () => {
		const { change } = await run({
			status: "resolved",
			resolution: { type: "next_release" },
		});
		expect(change).toMatchObject({ resolvedRelease: null });
	});

	it("'release X' es inclusiva y registra la release para poder ordenarla", async () => {
		const { change, releases } = await run({
			status: "resolved",
			resolution: { type: "release", release: "2.5.0" },
		});
		expect(change).toEqual({
			status: "resolved",
			resolvedRelease: "2.5.0",
			resolvedInclusive: true,
		});
		expect(releases.ensure).toHaveBeenCalledWith(PROJECT_ID, "2.5.0");
	});

	it("ignorar o reabrir descarta cualquier resolución previa", async () => {
		const { change } = await run({ status: "unresolved" }, "2.4.0");
		expect(change).toEqual({
			status: "unresolved",
			resolvedRelease: null,
			resolvedInclusive: false,
		});
	});
});
