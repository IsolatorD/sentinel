import { Injectable, NotFoundException } from "@nestjs/common";
import {
	PERIOD_CONFIG,
	type StatsDto,
	type StatsPeriod,
} from "@sentinel/shared";
import { OrgAccessService } from "../../organizations/org-access.service.js";
import { ProjectsService } from "../../projects/projects.service.js";
import { IssuesRepository } from "../issues.repository.js";
import { bucketRange, fillBuckets } from "./stats.domain.js";
import { StatsRepository } from "./stats.repository.js";

/** El gráfico de cada fila del listado: las últimas 24 h, una barra por hora. */
const TREND_PERIOD: StatsPeriod = "24h";

@Injectable()
export class StatsService {
	constructor(
		private readonly stats: StatsRepository,
		private readonly issues: IssuesRepository,
		private readonly access: OrgAccessService,
		private readonly projects: ProjectsService,
	) {}

	async project(
		userId: string,
		orgId: string,
		projectId: string,
		period: StatsPeriod,
		now = new Date(),
	): Promise<StatsDto> {
		await this.access.assert(userId, orgId, "member");
		await this.projects.ensureExists(orgId, projectId);
		const range = bucketRange(now, period);
		const rows = await this.stats.projectSeries(
			projectId,
			range.from,
			PERIOD_CONFIG[period].bucketHours,
		);
		return toDto(period, range, rows);
	}

	async issue(
		userId: string,
		orgId: string,
		projectId: string,
		issueId: string,
		period: StatsPeriod,
		now = new Date(),
	): Promise<StatsDto> {
		await this.access.assert(userId, orgId, "member");
		await this.projects.ensureExists(orgId, projectId);
		if (!(await this.issues.findInProject(projectId, issueId)))
			throw new NotFoundException({ reason: "ISSUE_NOT_FOUND" });
		const range = bucketRange(now, period);
		const rows = await this.stats.issueSeries(
			issueId,
			range.from,
			PERIOD_CONFIG[period].bucketHours,
		);
		return toDto(period, range, rows);
	}

	/** Las últimas 24 h por hora de cada issue (sin permisos: quien llama ya los comprobó). */
	async trends(
		issueIds: string[],
		now = new Date(),
	): Promise<Record<string, number[]>> {
		const range = bucketRange(now, TREND_PERIOD);
		const byIssue = await this.stats.issuesSeries(
			issueIds,
			range.from,
			PERIOD_CONFIG[TREND_PERIOD].bucketHours,
		);
		return Object.fromEntries(
			issueIds.map((id) => [
				id,
				fillBuckets(byIssue.get(id) ?? [], range).map((p) => p.events),
			]),
		);
	}
}

function toDto(
	period: StatsPeriod,
	range: ReturnType<typeof bucketRange>,
	rows: Parameters<typeof fillBuckets>[0],
): StatsDto {
	const points = fillBuckets(rows, range);
	return {
		period,
		bucketMinutes: range.bucketMs / 60_000,
		from: range.from.toISOString(),
		to: range.to.toISOString(),
		totalEvents: points.reduce((sum, p) => sum + p.events, 0),
		points,
	};
}
