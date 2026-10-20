import { ForbiddenException, NotFoundException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { describe, expect, it, vi } from "vitest";
import type { ApiEnv } from "../config/env.js";
import { OrgAccessService } from "../organizations/org-access.service.js";
import type { OrganizationsRepository } from "../organizations/organizations.repository.js";
import type { QuotaService } from "../quota/quota.service.js";
import {
	type KeyRow,
	type ProjectRow,
	type ProjectsRepository,
	UniqueConflictError,
} from "./projects.repository.js";
import { ProjectsService } from "./projects.service.js";

const now = new Date("2026-10-09T12:00:00Z");
const projectRow = (over: Partial<ProjectRow> = {}): ProjectRow => ({
	id: "11111111-1111-4111-8111-111111111111",
	organizationId: "org-1",
	name: "Mi App",
	slug: "mi-app",
	platform: "javascript",
	retentionDays: 90,
	monthlyEventQuota: null,
	monthlyTransactionQuota: null,
	createdAt: now,
	...over,
});
const keyRow = (over: Partial<KeyRow> = {}): KeyRow => ({
	id: "22222222-2222-4222-8222-222222222222",
	projectId: "11111111-1111-4111-8111-111111111111",
	publicKey: "0123456789abcdef0123456789abcdef",
	label: "Default",
	isActive: true,
	createdAt: now,
	...over,
});

function setup(
	role: string | undefined,
	repo: Partial<ProjectsRepository> = {},
	env: Record<string, unknown> = {},
) {
	const access = new OrgAccessService({
		findMemberRole: async () => role,
	} as unknown as OrganizationsRepository);
	const values: Record<string, unknown> = {
		PUBLIC_API_URL: "http://localhost:3000",
		...env,
	};
	const config = {
		get: (key: string) => values[key],
	} as unknown as ConfigService<ApiEnv, true>;
	const quota = { invalidate: vi.fn() } as unknown as QuotaService;
	return new ProjectsService(repo as ProjectsRepository, access, quota, config);
}

describe("ProjectsService", () => {
	it("un miembro simple puede leer pero no crear ni borrar", async () => {
		const repo = {
			listByOrganization: vi.fn(async () => [projectRow()]),
			createWithKey: vi.fn(),
			delete: vi.fn(),
		};
		const service = setup("member", repo);

		await expect(service.list("u", "org-1")).resolves.toHaveLength(1);
		await expect(
			service.create("u", "org-1", { name: "X", platform: "react" }),
		).rejects.toBeInstanceOf(ForbiddenException);
		await expect(
			service.remove("u", "org-1", projectRow().id),
		).rejects.toBeInstanceOf(ForbiddenException);
		expect(repo.createWithKey).not.toHaveBeenCalled();
		expect(repo.delete).not.toHaveBeenCalled();
	});

	it("un no miembro no llega al repositorio (404)", async () => {
		const repo = { listByOrganization: vi.fn() };
		await expect(
			setup(undefined, repo).list("u", "org-1"),
		).rejects.toBeInstanceOf(NotFoundException);
		expect(repo.listByOrganization).not.toHaveBeenCalled();
	});

	it("los proyectos nuevos nacen con la retención y las cuotas configuradas por el operador", async () => {
		const createWithKey = vi.fn(async (_input: Record<string, unknown>) => ({
			project: projectRow(),
			key: keyRow(),
		}));
		await setup("owner", { createWithKey } as Partial<ProjectsRepository>, {
			DEFAULT_RETENTION_DAYS: 30,
			DEFAULT_MONTHLY_EVENT_QUOTA: 10_000,
			DEFAULT_MONTHLY_TRANSACTION_QUOTA: 5_000,
		}).create("u", "org-1", { name: "Mi App", platform: "javascript" });
		expect(createWithKey.mock.calls[0][0]).toMatchObject({
			retentionDays: 30,
			monthlyEventQuota: 10_000,
			monthlyTransactionQuota: 5_000,
		});
	});

	it("crea el proyecto con la DSN de su primera clave", async () => {
		const repo = {
			createWithKey: vi.fn(async () => ({
				project: projectRow(),
				key: keyRow(),
			})),
		};
		const dto = await setup("owner", repo).create("u", "org-1", {
			name: "Mi App",
			platform: "javascript",
		});

		expect(repo.createWithKey).toHaveBeenCalledWith(
			{
				organizationId: "org-1",
				name: "Mi App",
				slug: "mi-app",
				platform: "javascript",
			},
			expect.stringMatching(/^[0-9a-f]{32}$/),
		);
		expect(dto.keys).toHaveLength(1);
		expect(dto.keys?.[0].dsn).toBe(
			`http://${keyRow().publicKey}@localhost:3000/${keyRow().projectId}`,
		);
	});

	it("reintenta con un sufijo si el slug ya existe", async () => {
		const createWithKey = vi
			.fn()
			.mockRejectedValueOnce(new UniqueConflictError())
			.mockResolvedValueOnce({
				project: projectRow({ slug: "mi-app-ab12" }),
				key: keyRow(),
			});
		const dto = await setup("admin", { createWithKey }).create("u", "org-1", {
			name: "Mi App",
			platform: "javascript",
		});

		expect(createWithKey).toHaveBeenCalledTimes(2);
		expect(createWithKey.mock.calls[0][0].slug).toBe("mi-app");
		expect(createWithKey.mock.calls[1][0].slug).toMatch(/^mi-app-[0-9a-f]{4}$/);
		expect(dto.slug).toBe("mi-app-ab12");
	});

	it("falla si no logra un slug único tras varios intentos", async () => {
		const createWithKey = vi.fn().mockRejectedValue(new UniqueConflictError());
		await expect(
			setup("owner", { createWithKey }).create("u", "org-1", {
				name: "X",
				platform: "node",
			}),
		).rejects.toThrow(/unique project slug/);
		expect(createWithKey).toHaveBeenCalledTimes(4);
	});

	it("propaga errores que no son de unicidad sin reintentar", async () => {
		const createWithKey = vi.fn().mockRejectedValue(new Error("db caída"));
		await expect(
			setup("owner", { createWithKey }).create("u", "org-1", {
				name: "X",
				platform: "node",
			}),
		).rejects.toThrow("db caída");
		expect(createWithKey).toHaveBeenCalledTimes(1);
	});

	it("un proyecto de otra organización se trata como inexistente", async () => {
		const repo = { findInOrganization: vi.fn(async () => undefined) };
		await expect(
			setup("owner", repo).get("u", "org-1", projectRow().id),
		).rejects.toBeInstanceOf(NotFoundException);
		expect(repo.findInOrganization).toHaveBeenCalledWith(
			"org-1",
			projectRow().id,
		);
	});

	it("operar sobre una clave inexistente da 404", async () => {
		const repo = {
			findInOrganization: vi.fn(async () => projectRow()),
			updateKey: vi.fn(async () => undefined),
			deleteKey: vi.fn(async () => false),
		};
		const service = setup("owner", repo);
		const ids = [projectRow().id, keyRow().id] as const;
		await expect(
			service.updateKey("u", "org-1", ids[0], ids[1], { isActive: false }),
		).rejects.toBeInstanceOf(NotFoundException);
		await expect(
			service.removeKey("u", "org-1", ids[0], ids[1]),
		).rejects.toBeInstanceOf(NotFoundException);
	});

	it("isIngestKeyValid delega en el repositorio", async () => {
		const isActiveKey = vi.fn(async () => true);
		await expect(
			setup("member", { isActiveKey }).isIngestKeyValid("p", "k"),
		).resolves.toBe(true);
		expect(isActiveKey).toHaveBeenCalledWith("p", "k");
	});
});
